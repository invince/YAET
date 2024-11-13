const { app, BrowserWindow, ipcMain } = require('electron');
const pty = require('node-pty');
const { Client } = require('ssh2');

let mainWindow;
let terminalMap = new Map();

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
  const id = data.terminalId; // cf ElectronService

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

  terminalMap.set(id, ptyProcess);

});

ipcMain.on('terminal-input', (event, data) => {
  const id = data.terminalId; // cf terminal.component.ts
  const input = data.input;
  const ptyProcess = terminalMap.get(id);
  if (ptyProcess) {
    ptyProcess.write(input);
  }
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
