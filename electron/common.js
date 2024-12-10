const path = require("path");
const fs = require("fs");

const CONFIG_FOLDER = 'config';
const BACKUP_FOLDER = 'backup';
const GIT_FOLDER = 'git';
const SETTINGS_JSON = 'settings.json';
const PROFILES_JSON = 'profiles.json';
const SECRETS_JSON = 'secrets.json';
const CLOUD_JSON = 'cloud.json';
const MANIFEST_JSON = 'manitfest.json';

function load(jsonFileName, loadedEvent, isRaw, mainWindow) {
  try {
    const settingsPath = path.join(process.cwd(), jsonFileName); // same folder as exe
    if (fs.existsSync(settingsPath)){
      fs.readFile(settingsPath, 'utf-8', (err, data) => {
        if (!err) {
          const settings = isRaw ? data : JSON.parse(data);
          console.debug(jsonFileName + " loaded, event sent");
          mainWindow.webContents.send(loadedEvent, settings);
        }
      });
    } else {
      hasConfig(jsonFileName).then(
        has => {
          if (!has) {
            mainWindow.webContents.send(loadedEvent, undefined);
          }
        }
      );
    }

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

function updateManifest(newConfigSaved) {
  try {
    const manifestFile = path.join(process.cwd(), CONFIG_FOLDER, MANIFEST_JSON); // same folder as exe
    if (!fs.existsSync(manifestFile)) {
      const manifest = {};
      manifest.data = [newConfigSaved];
      fs.writeFile(manifestFile, JSON.stringify(manifest, null, 2), 'utf8', (err) => {
        if (err) {
          console.error('Error writing JSON file:', err);
        } else {
          console.log('JSON file written successfully.');
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
              console.error('Error writing JSON file:', err);
            } else {
              console.log('JSON file written successfully.');
            }
          });
        }
      });
    }
  } catch (err) {
    console.error('Error reading manifest.json', err);
  }
}

function hasConfig(configToCheck) {
  return new Promise((resolve, reject) => {
    try {
      const manifestFile = path.join(process.cwd(), CONFIG_FOLDER, MANIFEST_JSON); // same folder as exe
      if (!fs.existsSync(manifestFile)) {
        const manifest = {};
        fs.writeFile(manifestFile, JSON.stringify(manifest, null, 2), 'utf8', (err) => {
          if (err) {
            console.error('Error writing JSON file:', err);
          } else {
            console.log('JSON file written successfully.');
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
      console.error('Error reading ' + jsonFileName, err);
    }
    resolve(false);
  });
}


module.exports = {load, save,
  CONFIG_FOLDER, BACKUP_FOLDER, GIT_FOLDER, SETTINGS_JSON, PROFILES_JSON, SECRETS_JSON, CLOUD_JSON,
  updateManifest, hasConfig

};
