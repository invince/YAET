
const { ipcMain } = require('electron');
const WebSocket = require('ws');
const findFreePorts = require('find-free-ports');
const net = require('net');


// for vnc, we create a websocket proxy to vnc server, than use noVnc to connect it
function initVncHandler(vncMap) {

  // Handle VNC Connection
  ipcMain.handle('session.open.rd.vnc', async (event, {id, host, port}) => {

// Configuration
    const proxyPorts = await findFreePorts(1, {startPort: 6900}); // Port for the WebSocket proxy
    const proxyPort = proxyPorts[0];

// Start the WebSocket server
    const wss = new WebSocket.Server({port: proxyPort});

    wss.on('connection', (ws) => {
      console.log('New WebSocket connection');

      console.log(`Connect to VNC server ${host}:${port}`);

      // Connect to the VNC server
      const vncSocket = net.createConnection(port, host,() => {
        console.log(`Connected to VNC server`);
        event.sender.send('session.connect.rd.vnc', { id: id});
      });

      // Forward data from WebSocket to VNC
      ws.on('message', (message) => {
        if (vncSocket.readyState === 'open') {
          vncSocket.write(message);
        }
      });

      // Forward data from VNC to WebSocket
      vncSocket.on('data', (data) => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(data);
        }
      });

      // Handle WebSocket close
      ws.on('close', () => {
        console.log('WebSocket connection closed');
        event.sender.send('session.disconnect.rd.vnc', { id: id});
        vncSocket.end();
      });

      // Handle VNC socket close
      vncSocket.on('close', () => {
        console.log('VNC connection closed');
        event.sender.send('session.disconnect.rd.vnc', { id: id});
        ws.close();
      });

      // Handle errors
      vncSocket.on('error', (err) => {
        console.error('VNC socket error:', err.message);
        event.sender.send('error', {
          category: 'vnc',
          id: id,
          error: `VNC socket error: ${err.message}`
        });
        ws.close();
      });

      ws.on('error', (err) => {
        console.error('WebSocket error:', err.message);
        event.sender.send('error', {
          category: 'vnc',
          id: id,
          error: `WebSocket error: ${err.message}`
        });
        vncSocket.end();
      });
    });

    console.log(`WebSocket proxy is running on ws://localhost:${proxyPort}`);

    vncMap.set(id, wss);

    return proxyPort;
  });

// Handle VNC Disconnection
  ipcMain.on('session.disconnect.rd.vnc', (event, {id}) => {
    if (id) {
      let vncClient = vncMap.get(id);
      if (vncClient) {
        vncClient.close(() => {
          console.log(`WebSocket server for ID: ${id} closed`);
        });
        vncMap.delete(id);
      }
    }
  });

}


module.exports = { initVncHandler };
