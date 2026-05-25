const { ipcMain } = require('electron');
const { VncDesktop } = require('../../../runtime/connectors/desktop/vnc');

const sessionSenders = new Map();
const sessions = new Map();

function initVncHandler(log, vncMap) {
  ipcMain.handle('session.open.rd.vnc', async (event, { id, host, port }) => {
    sessionSenders.set(id, event.sender);
    const desktop = new VncDesktop(log, { host, port });

    desktop.on('connected', () => {
      const sender = sessionSenders.get(id);
      if (sender) sender.send('session.connect.rd.vnc', { id });
    });

    desktop.on('disconnected', () => {
      const sender = sessionSenders.get(id);
      if (sender) sender.send('session.disconnect.rd.vnc', { id });
    });

    desktop.on('error', (error) => {
      const sender = sessionSenders.get(id);
      if (sender) sender.send('error', { category: 'vnc', id, error });
    });

    const { proxyPort } = await desktop.connect();
    sessions.set(id, desktop);
    vncMap.set(id, desktop.getWss());
    return proxyPort;
  });

  ipcMain.on('session.disconnect.rd.vnc', (event, { id }) => {
    const desktop = sessions.get(id);
    if (desktop) {
      desktop.disconnect();
      sessions.delete(id);
    }
    sessionSenders.delete(id);
  });
}

module.exports = { initVncHandler };
