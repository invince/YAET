const  rfb = require('rfb2');
const { ipcMain } = require('electron');

function initVncHandler(vncMap, mainWindow) {

  // Handle VNC Connection
  ipcMain.on('session.open.rd.vnc', (event, { id, host, port, password }) => {

    // Establish a connection to the VNC server
    let vncClient = rfb.createConnection({
      host,
      port,
      password,
    });

    vncClient.on('connect', () => {
      console.log('Connected to VNC server');
      event.sender.send('vnc.status', { id: id,  status: 'connected' });
    });

    vncClient.on('rect', (rect) => {
      if (rect.encoding === rfb.encodings.raw) {
        // Forward the rectangle data to the renderer
        console.log("frame: " + {id: id, frame: rect} )
        mainWindow.webContents.send('vnc.frame', {id: id, frame: rect});
      }
    });

    vncClient.on('error', (error) => {
      console.error('VNC Error:', error);
      event.sender.send('vnc.status', {id: id, status: 'error', message: error.message });
    });

    vncClient.on('disconnect', () => {
      console.log('Disconnected from VNC server');
      event.sender.send('vnc.status', { id: id, status: 'disconnected' });
    });

    vncMap.set(id, vncClient);
  });

// Handle VNC Disconnection
  ipcMain.on('session.disconnect.rd.vnc', (event, {id}) => {
    if (id) {
      let vncClient = vncMap.get(id);
      if (vncClient) {
        vncClient.end();
        vncMap.delete(id);
      }
    }
  });

}


module.exports = { initVncHandler };
