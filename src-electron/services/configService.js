const path = require('path');
const fs = require('fs');
const os = require('os');

const USER_HOME = process.env.YAET_HOME || os.homedir();
const APP_CONFIG_PATH = USER_HOME + '/.yaet';
const SETTINGS_JSON = 'settings.json';
const PROFILES_JSON = 'profiles.json';
const SECRETS_JSON = 'secrets.json';
const CLOUD_JSON = 'cloud.json';
const PROXIES_JSON = 'proxies.json';
const MANIFEST_JSON = 'manifest.json';

class ConfigService {
  constructor(log) {
    this.log = log;
    this.configPath = APP_CONFIG_PATH;
  }

  getConfigPath() {
    return this.configPath;
  }

  load(jsonFileName, isEncrypted = false) {
    return new Promise((resolve, reject) => {
      try {
        const settingsPath = path.join(this.configPath, jsonFileName);
        if (fs.existsSync(settingsPath)) {
          return fs.readFile(settingsPath, 'utf-8', (err, data) => {
            if (!err) {
              const result = isEncrypted ? data : JSON.parse(data);
              resolve(result);
            } else {
              reject(err);
            }
          });
        } else {
          resolve(undefined);
        }
      } catch (err) {
        this.log.error('Error reading ' + jsonFileName, err);
        reject(err);
      }
    });
  }

  save(jsonFileName, data, isEncrypted = false) {
    return new Promise((resolve, reject) => {
      try {
        const settingsPath = path.join(this.configPath, jsonFileName);
        const jsonString = isEncrypted ? data : JSON.stringify(data, null, 2);
        fs.writeFile(settingsPath, jsonString, 'utf8', (err) => {
          if (err) {
            this.log.error(`Error writing JSON ${jsonFileName}:`, err);
            reject(err);
          } else {
            this.log.info(`JSON ${jsonFileName} written successfully.`);
            resolve();
          }
        });
      } catch (error) {
        this.log.error('Error serializing content:', error);
        reject(error);
      }
    });
  }

  updateManifest(newConfigSaved) {
    if (!newConfigSaved) {
      this.log.warn('Empty name to update into manifest');
      return;
    }

    const manifestFile = path.join(this.configPath, MANIFEST_JSON);
    if (!fs.existsSync(manifestFile)) {
      const manifest = { data: [newConfigSaved] };
      fs.writeFile(manifestFile, JSON.stringify(manifest, null, 2), 'utf8', (err) => {
        if (err) this.log.error(`Error writing JSON ${MANIFEST_JSON}:`, err);
      });
    } else {
      fs.readFile(manifestFile, 'utf-8', (err, data) => {
        if (!err) {
          const manifest = JSON.parse(data);
          if (!manifest.data) manifest.data = [];
          if (!manifest.data.includes(newConfigSaved)) {
            manifest.data.push(newConfigSaved);
          }
          fs.writeFile(manifestFile, JSON.stringify(manifest, null, 2), 'utf8', (err) => {
            if (err) this.log.error(`Error writing JSON ${MANIFEST_JSON}:`, err);
          });
        }
      });
    }
  }

  hasConfig(configToCheck) {
    return new Promise((resolve) => {
      const manifestFile = path.join(this.configPath, MANIFEST_JSON);
      try {
        if (!fs.existsSync(manifestFile)) {
          fs.writeFile(manifestFile, JSON.stringify({ data: [] }, null, 2), 'utf8', (err) => {
            if (err) this.log.error(`Error writing JSON ${MANIFEST_JSON}:`, err);
            resolve(false);
          });
          return;
        }
        fs.readFile(manifestFile, 'utf-8', (err, data) => {
          if (err) {
            resolve(false);
            return;
          }
          try {
            const manifest = JSON.parse(data);
            resolve(manifest?.data?.includes(configToCheck) || false);
          } catch (parseErr) {
            resolve(false);
          }
        });
      } catch (err) {
        resolve(false);
      }
    });
  }

  getSettings() { return this.load(SETTINGS_JSON); }
  saveSettings(data) { return this.save(SETTINGS_JSON, data); }

  getProfiles() { return this.load(PROFILES_JSON, true); }
  saveProfiles(data) { return this.save(PROFILES_JSON, data, true); }

  getSecrets() { return this.load(SECRETS_JSON, true); }
  saveSecrets(data) { return this.save(SECRETS_JSON, data, true); }

  getCloud() { return this.load(CLOUD_JSON, true); }
  saveCloud(data) { return this.save(CLOUD_JSON, data, true); }

  getProxies() { return this.load(PROXIES_JSON, true); }
  saveProxies(data) { return this.save(PROXIES_JSON, data, true); }
}

module.exports = { ConfigService, APP_CONFIG_PATH, SETTINGS_JSON, PROFILES_JSON, SECRETS_JSON, CLOUD_JSON, PROXIES_JSON };
