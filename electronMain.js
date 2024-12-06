const {app, BrowserWindow, ipcMain} = require('electron');
const pty = require('node-pty');
const {Client} = require('ssh2');
const path = require("path");
const fs = require("fs");
const fsPromise = require("fs").promises;

let mainWindow;
let terminalMap = new Map();
const keytar = require('keytar');
const simpleGit = require("simple-git");

const CONFIG_FOLDER = 'config';
const BACKUP_FOLDER = 'backup';
const GIT_FOLDER = 'git';
const SETTINGS_JSON = 'settings.json';
const PROFILES_JSON = 'profiles.json';
const SECRETS_JSON = 'secrets.json';
const CLOUD_JSON = 'cloud.json';


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
    load(path.join(CONFIG_FOLDER, SETTINGS_JSON), "settings-loaded", false);
    load(path.join(CONFIG_FOLDER, PROFILES_JSON), "profiles-loaded", false);
    load(path.join(CONFIG_FOLDER, SECRETS_JSON), "secrets-loaded", true);
    load(path.join(CONFIG_FOLDER, CLOUD_JSON), "cloud-loaded", true);
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
      let jsonString = isRaw ? data : JSON.stringify(data, null, 2);
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
  load(path.join(CONFIG_FOLDER, SETTINGS_JSON), "settings-loaded", false);
});

ipcMain.on('settings-save', (event, obj) => {
  save(path.join(CONFIG_FOLDER, SETTINGS_JSON), obj.data, false)
    .then(() => console.log('Setting saved successfully!'))
    .catch((error) => console.error('Error saving file:', error));
});


ipcMain.on('profiles-reload', (event, obj) => {
  console.log("reloading...")
  load(path.join(CONFIG_FOLDER, PROFILES_JSON), "profiles-loaded", true);
});


ipcMain.on('profiles-save', (event, obj) => {
  save(path.join(CONFIG_FOLDER, PROFILES_JSON), obj.data, false)
    .then(() => console.log('Profiles saved successfully!'))
    .catch((error) => console.error('Error saving file:', error));
});

ipcMain.on('secrets-reload', (event, obj) => {
  console.log("reloading...")
  load(path.join(CONFIG_FOLDER, SECRETS_JSON), "secrets-loaded", true);
});

ipcMain.on('secrets-save', (event, obj) => {
  save(path.join(CONFIG_FOLDER, SECRETS_JSON), obj.data, true)
    .then(() => console.log('Secrets saved successfully!'))
    .catch((error) => console.error('Error saving file:', error));
});

ipcMain.on('cloud-reload', (event, obj) => {
  console.log("reloading...")
  load(path.join(CONFIG_FOLDER, CLOUD_JSON), "cloud-loaded", true);
});

ipcMain.on('cloud-save', (event, obj) => {
  save(path.join(CONFIG_FOLDER, CLOUD_JSON), obj.data, true)
    .then(() => console.log('Secrets saved successfully!'))
    .catch((error) => console.error('Error saving file:', error));
});

function validate(terminalExec) {
  if (!terminalExec) {
    return process.platform === 'win32' ? 'cmd.exe' : 'bash';
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
  console.log('Terminal id to find ' + id);
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


ipcMain.handle('cloud-upload', async (event, data) => {

  const response = {
    succeed: false,
    ok: [],
    ko: []
  }

  if (!data || !data.data) {
    console.error("no cloud setting found");
    response.ko.push("no cloud setting found");
    return response;
  }

  try {
    const gitAbsDir = path.join(process.cwd(), CONFIG_FOLDER, GIT_FOLDER);

    let cloudSettings = data.data;

    let gitUser = encodeURIComponent(cloudSettings.login);
    let gitPassword = encodeURIComponent(cloudSettings.password);
    let gitRepoUrl = cloudSettings.url;
    gitRepoUrl = gitRepoUrl.replace('https://', `https://${gitUser}:${gitPassword}@`);
    gitRepoUrl = gitRepoUrl.replace('http://', `http://${gitUser}:${gitPassword}@`);

    let jsonFiles = getJsonFilesForCloud(cloudSettings.items);

    // Step 1: Delete existing Git folder
    console.log('Deleting existing Git folder...');
    await fsPromise.rm(gitAbsDir, {recursive: true, force: true});

    // Step 2: Clone the Git repository
    console.log('Cloning repository...');
    const git = simpleGit();
    await git.clone(gitRepoUrl, gitAbsDir);

    // Step 3: Synchronize JSON files
    console.log('Synchronizing JSON files...');
    const filesInRepo = await fsPromise.readdir(gitAbsDir); // Get current files in the repo
    const fileToPush = jsonFiles.map(filePath => path.basename(filePath));
    // Delete files in the repo that are not in fileToPush
    for (const file of filesInRepo) {
      if (!fileToPush.includes(file) && file !== '.git') {
        const filePathToDelete = path.join(gitAbsDir, file);
        await fsPromise.rm(filePathToDelete, {recursive: true, force: true});
        response.ok.push('-' + file);
        console.log(`Deleted: ${file}`);
      }
    }
    // Replace or add files from fileToPush
    for (const jsonFilePath of jsonFiles) {
      const fileName = path.basename(jsonFilePath);
      const destinationFilePath = path.join(gitAbsDir, fileName);
      // Replace if exists, or add the file
      await fsPromise.copyFile(jsonFilePath, destinationFilePath);

      response.ok.push('+' + fileName);
      console.log(`Added or updated: ${fileName}`);
    }
    // Step 4: Commit and Push the Changes
    console.log('Committing and pushing changes...');
    await git.cwd(gitAbsDir); // Change working directory to the Git folder
    await git.add('.'); // Stage all changes
    await git.commit('Sync JSON files'); // Commit the changes
    await git.push('origin', 'main');

    response.ok.push('pushed');

    console.log('Successfully synchronized JSON files to the repository.');
  } catch(error) {
    console.error('Error during operation:', error.message);
    response.ko.push(error.message);
    return response;
  }
  response.succeed = true;
  return response;
});


ipcMain.handle('cloud-download', async (event, data) => {

  const response = {
    succeed: false,
    ok: [],
    ko: []
  }

  if (!data || !data.data) {
    console.error("no cloud setting found");
    response.ko.push("no cloud setting found");
    return response;
  }

  const backupAbsDir = path.join(process.cwd(), CONFIG_FOLDER, BACKUP_FOLDER);
  const gitAbsDir = path.join(process.cwd(), CONFIG_FOLDER, GIT_FOLDER);

  let cloudSettings = data.data;

  let gitUser = encodeURIComponent(cloudSettings.login);
  let gitPassword = encodeURIComponent(cloudSettings.password);
  let gitRepoUrl = cloudSettings.url;
  gitRepoUrl = gitRepoUrl.replace('https://', `https://${gitUser}:${gitPassword}@`);
  gitRepoUrl = gitRepoUrl.replace('http://', `http://${gitUser}:${gitPassword}@`);

  let jsonFiles = getJsonFilesForCloud(cloudSettings.items);

  try {
    // Step 1: Backup JSON files
    console.log('Backing up JSON files...');
    await fsPromise.rm(backupAbsDir, {recursive: true, force: true});
    await fsPromise.mkdir(backupAbsDir, {recursive: true});

    for (const file of jsonFiles) {
      const fileName = path.basename(file);
      const backupFilePath = path.join(backupAbsDir, fileName);

      try {
        await fsPromise.copyFile(file, backupFilePath);
        console.log(`Backed up: ${fileName}`);
      } catch (err) {
        if (err.code === 'ENOENT') {
          console.warn(`File not found (skipping): ${fileName}`);
        } else {
          throw err;
        }
      }
    }

    // Step 2: Delete existing Git folder
    console.log('Deleting existing Git folder...');
    await fsPromise.rm(gitAbsDir, {recursive: true, force: true});

    // Step 3: Clone the repository
    console.log('Cloning repository...');
    const git = simpleGit();
    await git.clone(gitRepoUrl, gitAbsDir);

    // Step 4: Replace JSON files in the Git folder
    console.log('Replacing JSON files ...');
    for (const file of jsonFiles) {
      const fileName = path.basename(file);
      const gitFilePath = path.join(gitAbsDir, fileName);

      try {
        // Check if the file exists in the cloned repo
        await fsPromise.access(gitFilePath);

        // Replace the file
        await fsPromise.copyFile(gitFilePath, file);
        response.ok.push('<->' + fileName);
        console.log(`Replaced in Git repo: ${fileName}`);
      } catch (err) {
        if (err.code === 'ENOENT') {
          console.warn(`File not found in Git repo (skipping): ${fileName}`);
        } else {
          throw err;
        }
      }
    }

    console.log('Operation completed successfully.');
  } catch (error) {
    console.error('Error:', error.message);
    response.ko.push(error.message);
    return response;
  }
  response.succeed = true;
  return response;
});


function getJsonFilesForCloud(items) {
  if (!items) {
    return [];
  }
  const configAbsDir = path.join(process.cwd(), CONFIG_FOLDER);
  const result = [];
  for (const item of items) {
    if (item.toLowerCase() === 'Setting'.toLowerCase()) {
      result.push(path.join(configAbsDir,SETTINGS_JSON));
    }
    if (item.toLowerCase() === 'Profile'.toLowerCase()) {
      result.push(path.join(configAbsDir,PROFILES_JSON));
    }
    if (item.toLowerCase() === 'Secret'.toLowerCase()) {
      result.push(path.join(configAbsDir,SECRETS_JSON));
    }
  }
  return result;
}
