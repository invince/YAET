const path = require("path");
const fs = require("fs");
const os = require('os');

const USER_HOME = os.homedir();
const APP_CONFIG_PATH = USER_HOME + '/.yaet'
const BACKUP_FOLDER = 'backup';
const GIT_FOLDER = 'git';
const SETTINGS_JSON = 'settings.json';
const PROFILES_JSON = 'profiles.json';
const SECRETS_JSON = 'secrets.json';
const CLOUD_JSON = 'cloud.json';
const MANIFEST_JSON = 'manifest.json';



function load(log, mainWindow, jsonFileName, loadedEvent, isRaw) {
  return new Promise((resolve, reject) => {
    try {
      const settingsPath = path.join(APP_CONFIG_PATH, jsonFileName); // same folder as exe
      log.info(settingsPath);
      if (fs.existsSync(settingsPath)){
        return fs.readFile(settingsPath, 'utf-8', (err, data) => {
          if (!err) {
            const settings = isRaw ? data : JSON.parse(data);
            mainWindow.webContents.send(loadedEvent, settings);
            resolve(settings);
          } else {
            reject(err);
          }
        });
      } else {
        hasConfig(log, jsonFileName).then(
          has => {
            if (!has) {
              mainWindow.webContents.send(loadedEvent, undefined);
              resolve(undefined);
            } else {
              reject({error: 'Failed to load settings.'});
            }
          }
        );
      }

    } catch (err) {
      log.error('Error reading ' + jsonFileName, err);
      reject(err);
    }
  });
}

function save(log, jsonFileName, data, isRaw) {
  return new Promise((resolve, reject) => {
    try {
      const settingsPath = path.join(APP_CONFIG_PATH, jsonFileName); // same folder as exe
      // Convert content to JSON string with pretty format
      let jsonString = isRaw ? data : JSON.stringify(data, null, 2);
      // Write the JSON string to the specified file
      fs.writeFile(settingsPath, jsonString, 'utf8', (err) => {
        if (err) {
          log.error('Error writing JSON file:', err);
          reject(err);
        } else {
          log.info('JSON file written successfully.');
          resolve();
        }
      });
    } catch (error) {
      log.error('Error serializing content:', error);
      reject(error);
    }
  });
}

function updateManifest(log, newConfigSaved) {
  try {
    if (!newConfigSaved) {
      log.warn('Error writing JSON file:', newConfigSaved);
    }

    const manifestFile = path.join(APP_CONFIG_PATH, MANIFEST_JSON); // same folder as exe
    if (!fs.existsSync(manifestFile)) {
      const manifest = {};
      manifest.data = [newConfigSaved];
      fs.writeFile(manifestFile, JSON.stringify(manifest, null, 2), 'utf8', (err) => {
        if (err) {
          log.error('Error writing JSON file:', err);
        } else {
          log.info('JSON file written successfully.');
        }
      });
    } else {
      fs.readFile(manifestFile, 'utf-8', (err, data) => {
        if (!err) {
          const manifest = JSON.parse(data);
          if (!manifest.data) {
            manifest.data = [];
          }
          if (!manifest.data.includes(newConfigSaved)) {
            manifest.data.push(newConfigSaved);
          }

          fs.writeFile(manifestFile, JSON.stringify(manifest, null, 2), 'utf8', (err) => {
            if (err) {
              log.error('Error writing JSON file:', err);
            } else {
              log.info('JSON file written successfully.');
            }
          });
        }
      });
    }
  } catch (err) {
    log.error('Error reading manifest.json', err);
  }
}

function hasConfig(log, configToCheck) {
  return new Promise((resolve, reject) => {
    const manifestFile = path.join(APP_CONFIG_PATH, MANIFEST_JSON); // same folder as exe
    try {
      if (!fs.existsSync(manifestFile)) {
        const manifest = {};
        fs.writeFile(manifestFile, JSON.stringify(manifest, null, 2), 'utf8', (err) => {
          if (err) {
            log.error('Error writing JSON file:', err);
          } else {
            log.info('JSON file written successfully.');
          }
        });

      } else {
        fs.readFile(manifestFile, 'utf-8', (err, data) => {
          if (!err) {
            const manifest = JSON.parse(data);
            if (!manifest.data) {
              manifest.data = [];
            }
            if (manifest.data.includes(configToCheck)) {
              resolve(true);
            }
          }
        });
      }
    } catch (err) {
      log.error('Error reading ' + manifestFile, err);
    }
    resolve(false);
  });
}


module.exports = {load, save,
  BACKUP_FOLDER, GIT_FOLDER, SETTINGS_JSON, PROFILES_JSON, SECRETS_JSON, CLOUD_JSON,
  updateManifest, APP_CONFIG_PATH
};
