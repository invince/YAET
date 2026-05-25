const { ipcMain } = require('electron');
const { TelnetSession } = require('../../../runtime/connectors/terminal/telnet');

const sessions = new Map();

function initTelnetIpcHandler(log, terminalMap, proxyRepo, secretRepo) {

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

      sessions.set(data.terminalId, session);
    } catch (error) {
      event.sender.send('error', {
        category: 'telnet',
        id: data.terminalId,
        error: error.message,
      });
      sessions.delete(data.terminalId);
    }
  });

  ipcMain.on('session.close.terminal.telnet', (event, data) => {
    const session = sessions.get(data.terminalId);
    if (session) session.close();
    sessions.delete(data.terminalId);
  });
}

module.exports = { initTelnetIpcHandler };
