const { app, BrowserWindow, ipcMain } = require('electron');
const pty = require('node-pty');
const { Client } = require('ssh2');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      enableRemoteModule: true,
    },
  });

  mainWindow.loadURL(`http://localhost:4200`);
}

app.on('ready', createWindow);

ipcMain.on('create-local-terminal', (event, data) => {
  const shell = process.platform === 'win32' ? 'cmd.exe' : 'bash';
  const ptyProcess = pty.spawn(shell, [], {
    name: 'xterm-color',
    cols: 80,
    rows: 30,
    cwd: process.env.HOME,
    env: process.env,
  });

  ptyProcess.on('data', (data) => {
    event.sender.send('terminal-output', data);
  });

  event.sender.on('terminal-input', (input) => {
    ptyProcess.write(input);
  });
});

ipcMain.on('create-ssh-terminal', (event, sshConfig) => {
  const conn = new Client();
  conn.on('ready', () => {
    conn.shell((err, stream) => {
      if (err) throw err;
      stream.on('data', (data) => {
        event.sender.send('terminal-output', data.toString());
      });

      event.sender.on('terminal-input', (input) => {
        stream.write(input);
      });
    });
  }).connect(sshConfig);
});
