const { ipcMain } = require('electron');
const { VNCService } = require('../../../services/vncService');

let vncService = null;
const sessionSenders = new Map();

function initVncHandler(log, vncMap) {
  vncService = new VNCService(log);

  vncService.on('connected', ({ id }) => {
    const sender = sessionSenders.get(id);
    if (sender) sender.send('session.connect.rd.vnc', { id });
  });

  vncService.on('disconnected', ({ id }) => {
    const sender = sessionSenders.get(id);
    if (sender) sender.send('session.disconnect.rd.vnc', { id });
  });

  vncService.on('error', ({ id, error }) => {
    const sender = sessionSenders.get(id);
    if (sender) sender.send('error', { category: 'vnc', id, error });
  });

  ipcMain.handle('session.open.rd.vnc', async (event, { id, host, port }) => {
    sessionSenders.set(id, event.sender);
    const proxyPort = await vncService.startProxy(id, host, port);
    vncMap.set(id, vncService.vncMap.get(id));
    return proxyPort;
  });

  ipcMain.on('session.disconnect.rd.vnc', (event, { id }) => {
    vncService.stopProxy(id);
    sessionSenders.delete(id);
  });
}

module.exports = { initVncHandler };
