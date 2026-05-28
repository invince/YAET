const { ipcMain } = require('electron');
const { TelnetSession } = require('../../../runtime/connectors/terminal/telnet');

function initTelnetIpcHandler(log, terminalMap, proxyRepo, secretRepo, registry) {

  ipcMain.on('session.open.terminal.telnet', async (event, data) => {
    const session = new TelnetSession(log);

    session.on('output', ({ data: output }) => {
      event.sender.send('terminal.output', { id: data.terminalId, data: output });
    });

    session.on('error', ({ error }) => {
      event.sender.send('error', { category: 'telnet', id: data.terminalId, error });
    });

    try {
      let proxy = null;
      if (data.proxyId && proxyRepo) {
        const proxies = proxyRepo();
        if (proxies && proxies.proxies) {
          proxy = proxies.proxies.find(p => p.id === data.proxyId);
        }
      }

      await session.connect({
        ...data.config,
        proxy,
        secretRepo,
      });

      terminalMap.set(data.terminalId, {
        type: 'telnet',
        process: session.client,
        callback: (input) => session.write(input),
      });

      if (registry) registry.register(data.terminalId, 'telnet', 'user', session);
    } catch (error) {
      event.sender.send('error', {
        category: 'telnet',
        id: data.terminalId,
        error: error.message,
      });
    }
  });

  ipcMain.on('session.close.terminal.telnet', (event, data) => {
    const entry = registry ? registry.get(data.terminalId) : null;
    const session = entry ? entry.session : null;
    if (session) session.close();
    if (registry) registry.unregister(data.terminalId);
  });
}

module.exports = { initTelnetIpcHandler };
