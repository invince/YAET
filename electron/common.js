const path = require("path");
const fs = require("fs");

const CONFIG_FOLDER = 'config';
const BACKUP_FOLDER = 'backup';
const GIT_FOLDER = 'git';
const SETTINGS_JSON = 'settings.json';
const PROFILES_JSON = 'profiles.json';
const SECRETS_JSON = 'secrets.json';
const CLOUD_JSON = 'cloud.json';

function load(jsonFileName, loadedEvent, isRaw, mainWindow) {
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


module.exports = {load, save, CONFIG_FOLDER, BACKUP_FOLDER, GIT_FOLDER, SETTINGS_JSON, PROFILES_JSON, SECRETS_JSON, CLOUD_JSON};
