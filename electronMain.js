const { app, BrowserWindow, ipcMain } = require('electron');
const pty = require('node-pty');
const { Client } = require('ssh2');
const path = require("path");
const fs = require("fs");

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
      // preload: path.join(__dirname, 'preload.js'), // FIXME: preload need contextIsolation, but xterm.js won't work with that
    },
  });

  mainWindow.loadURL(`http://localhost:4200`);


  load('settings.json', "settings-loaded");
  load('profiles.json', "profiles-loaded");
}

app.on('ready', createWindow);

function load(jsonFileName, loadedEvent) {
  try {
    const settingsPath = path.join(process.cwd(), jsonFileName); // same folder as exe
    fs.readFile(settingsPath, 'utf-8', (err, data) => {
      if (!err) {
        const settings = JSON.parse(data);
        mainWindow.webContents.once('dom-ready', () => {
          mainWindow.webContents.send(loadedEvent, settings);
        });
      }
    });
  } catch (err) {
    console.error('Error reading ' + jsonFileName, err);
    return null;
  }
}

function save(jsonFileName, data) {
  return new Promise((resolve, reject) => {
    try {
      const settingsPath = path.join(process.cwd(), jsonFileName); // same folder as exe
      // Convert content to JSON string with pretty format
      const jsonString = JSON.stringify(data, null, 2);

      // Write the JSON string to the specified file
      fs.writeFile(settingsPath, jsonString, 'utf8', (err) => {
        if (err) {
          console.error('Error writing JSON file:', err);
          reject(err);
        } else {
          console.log('JSON file written successfully.');
          resolve();
        }
      });
    } catch (error) {
      console.error('Error serializing content:', error);
      reject(error);
    }
  });
}

ipcMain.on('settings-save', (event, obj) => {
  save('settings.json', obj.data)
    .then(() => console.log('File saved successfully!'))
    .catch((error) => console.error('Error saving file:', error));
});

function validate(terminalExec) {
  if (!terminalExec) {
    return  process.platform === 'win32' ? 'cmd.exe' : 'bash';
  }
  return terminalExec;
}

ipcMain.on('create-local-terminal', (event, data) => {
  const id = data.terminalId; // cf ElectronService
  let shell = validate(data.terminalExec);

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
