const { SerialSession } = require('./serial.connector');

function register(context) {
  const { ipcMain, logger, sessionRegistry, terminalMap, runtimeAPI } = context;

  const api = typeof runtimeAPI === 'function' ? runtimeAPI() : runtimeAPI;
  if (api) {
    api.registerConnector('SERIAL_TERMINAL', (log, config) => {
      return new SerialSession(log, config);
    });
    api.registerConfigResolver('SERIAL_TERMINAL', (connProfile) => {
      return {
        path: connProfile.path,
        baudRate: parseInt(connProfile.baudRate, 10) || 9600,
        dataBits: parseInt(connProfile.dataBits, 10) || 8,
        stopBits: parseFloat(connProfile.stopBits) || 1,
        parity: connProfile.parity || 'none',
        rtscts: !!connProfile.rtscts,
        xon: !!connProfile.xon,
        xoff: !!connProfile.xoff,
      };
    });
  }

  // Handle port listing
  ipcMain.handle('serial.list-ports', async () => {
    try {
      const { SerialPort } = require('serialport');
      const ports = await SerialPort.list();
      return ports.map(p => ({
        path: p.path,
        manufacturer: p.manufacturer || '',
        friendlyName: p.friendlyName || p.path
      }));
    } catch (err) {
      logger.error('[serial-terminal] Failed to list serial ports:', err);
      return [];
    }
  });

  // Handle open session
  ipcMain.on('session.open.terminal.serial', async (event, data) => {
    const session = new SerialSession(logger);

    session.on('output', ({ data: output }) => {
      event.sender.send('terminal.output', { id: data.id, data: output });
    });

    session.on('error', ({ error }) => {
      event.sender.send('error', { category: 'serial', id: data.id, error });
    });

    session.on('disconnect', ({ error }) => {
      event.sender.send('session.disconnect.terminal.serial', { id: data.id, error: !!error });
    });

    try {
      await session.connect(data.config);

      if (terminalMap) {
        terminalMap.set(data.id, {
          type: 'serial',
          process: session.port,
          callback: (input) => session.write(input),
          resize: (cols, rows) => { /* serial doesn't support resize */ },
          close: () => { try { session.close(); } catch { /* ignore */ } },
        });
      }

      const registry = typeof sessionRegistry === 'function'
        ? sessionRegistry() : sessionRegistry;
      if (registry) registry.register(data.id, 'serial', 'user', session);
    } catch (error) {
      event.sender.send('error', {
        category: 'serial',
        id: data.id,
        error: error.message,
      });
    }
  });

  // Handle close session
  ipcMain.on('session.close.terminal.serial', (event, data) => {
    const registry = typeof sessionRegistry === 'function'
      ? sessionRegistry() : sessionRegistry;
    const entry = registry?.get(data.id);
    if (entry?.session) entry.session.close();
    registry?.unregister(data.id);
  });

  logger.info('[serial-terminal] Plugin registered');
}

module.exports = { register };
