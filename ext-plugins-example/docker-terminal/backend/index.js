const { DockerExecSession } = require('./docker.connector');
const Docker = require('dockerode');

function register(context) {
  const { ipcMain, logger, sessionRegistry, runtimeAPI } = context;

  const api = typeof runtimeAPI === 'function' ? runtimeAPI() : runtimeAPI;
  if (api) {
    api.registerConnector('DOCKER_TERMINAL', (log, config) => {
      return new DockerExecSession(log, config);
    });
  }

  const terminalMap = context.terminalMap;

  ipcMain.handle('docker.list-containers', async () => {
    try {
      const docker = new Docker();
      await docker.ping();
      const containers = await docker.listContainers({ all: false });
      return containers.map(c => ({
        id: c.Id.substring(0, 12),
        names: (c.Names || []).map(n => n.replace(/^\//, '')),
        image: c.Image,
        state: c.State,
        status: c.Status,
      }));
    } catch (err) {
      logger.error('[docker-terminal] Failed to list containers:', err.message);
      return [];
    }
  });

  ipcMain.on('session.open.terminal.docker', async (event, data) => {
    if (!data || !data.config) {
      event.sender.send('error', {
        category: 'docker',
        id: data?.id || 'unknown',
        error: 'Invalid session data: missing config',
      });
      return;
    }

    if (!data.config.container || !data.config.container.trim()) {
      event.sender.send('error', {
        category: 'docker',
        id: data.id,
        error: 'Container ID or name is required. Please fill in the container field.',
      });
      return;
    }

    const session = new DockerExecSession(logger);

    session.on('output', ({ data: output }) => {
      event.sender.send('terminal.output', { id: data.id, data: output });
    });

    session.on('error', ({ error }) => {
      event.sender.send('error', { category: 'docker', id: data.id, error });
    });

    session.on('disconnect', ({ error }) => {
      event.sender.send('session.disconnect.terminal.docker', { id: data.id, error: !!error });
    });

    try {
      await session.connect(data.config);

      const registry = typeof sessionRegistry === 'function' ? sessionRegistry() : sessionRegistry;
      if (registry) registry.register(data.id, 'docker', 'user', session);

      if (terminalMap) {
        terminalMap.set(data.id, {
          type: 'docker',
          process: session.stream,
          stream: session.stream,
          callback: (input) => session.write(input),
          resize: (cols, rows) => session.resize(cols, rows),
          close: () => { try { session.close(); } catch {} },
        });
      }
    } catch (error) {
      event.sender.send('error', {
        category: 'docker',
        id: data.id,
        error: error.message,
      });
    }
  });

  ipcMain.on('session.close.terminal.docker', (event, data) => {
    const registry = typeof sessionRegistry === 'function' ? sessionRegistry() : sessionRegistry;
    const entry = registry ? registry.get(data.id) : null;
    const session = entry ? entry.session : null;
    if (session) session.close();
    if (registry) registry.unregister(data.id);
  });

  logger.info('[docker-terminal] Plugin registered');
}

module.exports = { register };
