const { app, BrowserWindow, ipcMain } = require('electron');
const pty = require('node-pty');
const { Client } = require('ssh2');
const path = require("path");
const fs = require("fs");

let mainWindow;
let terminalMap = new Map();
const keytar = require('keytar');



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

  mainWindow.webContents.once('dom-ready', () => {
    load('config/settings.json', "settings-loaded", false);
    load('config/profiles.json', "profiles-loaded", false);
    load('config/secrets.json', "secrets-loaded", true);
    load('config/cloud.json', "cloud-loaded", true);
  })
}

app.on('ready', createWindow);


function load(jsonFileName, loadedEvent, isRaw) {
  try {
    const settingsPath = path.join(process.cwd(), jsonFileName); // same folder as exe
    fs.readFile(settingsPath, 'utf-8', (err, data) => {
      if (!err) {
        const settings = isRaw ? data : JSON.parse(data);
        console.debug(jsonFileName + " loaded, event sent");
        mainWindow.webContents.send(loadedEvent, settings);
      }
    });
  } catch (err) {
    console.error('Error reading ' + jsonFileName, err);
    return null;
  }
}

function save(jsonFileName, data, isRaw) {
  return new Promise((resolve, reject) => {
    try {
      const settingsPath = path.join(process.cwd(), jsonFileName); // same folder as exe
      // Convert content to JSON string with pretty format
      let jsonString = isRaw ? data : JSON.stringify(data, null, 2) ;
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

ipcMain.on('settings-reload', (event, obj) => {
  console.log("reloading...")
  load('config/settings.json', "settings-loaded", false);
});

ipcMain.on('settings-save', (event, obj) => {
  save('config/settings.json', obj.data, false)
    .then(() => console.log('Setting saved successfully!'))
    .catch((error) => console.error('Error saving file:', error));
});


ipcMain.on('profiles-reload', (event, obj) => {
  console.log("reloading...")
  load('config/profiles.json', "profiles-loaded", true);
});



ipcMain.on('profiles-save', (event, obj) => {
  save('config/profiles.json', obj.data, false)
    .then(() => console.log('Profiles saved successfully!'))
    .catch((error) => console.error('Error saving file:', error));
});

ipcMain.on('secrets-reload', (event, obj) => {
  console.log("reloading...")
  load('config/secrets.json', "secrets-loaded", true);
});

ipcMain.on('secrets-save', (event, obj) => {
  save('config/secrets.json', obj.data, true)
    .then(() => console.log('Secrets saved successfully!'))
    .catch((error) => console.error('Error saving file:', error));
});

ipcMain.on('cloud-reload', (event, obj) => {
  console.log("reloading...")
  load('config/cloud.json', "cloud-loaded", true);
});

ipcMain.on('cloud-save', (event, obj) => {
  save('config/cloud.json', obj.data, true)
    .then(() => console.log('Secrets saved successfully!'))
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

  terminalMap.set(id, (data) => ptyProcess.write(data));

});

ipcMain.on('terminal-input', (event, data) => {
  const id = data.terminalId; // cf terminal.component.ts
  const input = data.input;
  const terminalCallback = terminalMap.get(id);
  console.log ('Terminal id to find ' + id);
  if (terminalCallback) {
    console.log('Terminal found. Sending input.');
    terminalCallback(input); // Send input to the correct terminal
  } else {
    console.log('Terminal not found for id:', id);
  }
});

ipcMain.on('create-ssh-terminal', (event, data) => {
  const conn = new Client();
  const sshConfig = data.config;
  const id = data.terminalId;
  conn.on('ready', () => {
    console.log('SSH connection ready for id:', id);
    conn.shell((err, stream) => {
      if (err) {
        console.error('Error starting shell:', err);
        return;
      }
      console.log('Shell started for id:', id);

      stream.on('data', (data) => {
        event.sender.send('terminal-output', data.toString());
      });

      terminalMap.set(id, (data) => stream.write(data));
    });
  }).connect(sshConfig);
});




ipcMain.handle('keytar-save-password', async (event, service, account, password) => {
  return keytar.setPassword(service, account, password);
});

ipcMain.handle('keytar-get-password', async (event, service, account) => {
  return keytar.getPassword(service, account);
});

ipcMain.handle('keytar-delete-password', async (event, service, account) => {
  console.log("master key deleting...");
  return keytar.deletePassword(service, account);
});
