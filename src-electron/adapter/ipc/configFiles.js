const { ipcMain } = require('electron');
const { ConfigService, SETTINGS_JSON, PROFILES_JSON, SECRETS_JSON, CLOUD_JSON, PROXIES_JSON } = require("../../services/configService");

function initConfigFilesIpcHandler(log, mainWindow, reloadProxies, reloadSecrets) {
  const configService = new ConfigService(log);

  ipcMain.on('settings.reload', async () => {
    log.info("reload " + SETTINGS_JSON);
    try {
      const data = await configService.load(SETTINGS_JSON, false);
      mainWindow.webContents.send("settings.loaded", data);
      log.info(SETTINGS_JSON + " reloaded");
    } catch (err) {
      log.error(err);
    }
  });

  ipcMain.on('settings.save', (event, obj) => {
    configService.save(SETTINGS_JSON, obj.data, false)
      .then(() => {
        log.info('Setting saved successfully!');
        configService.updateManifest('settings.json');
      })
      .catch((error) => log.error('Error saving file:', error));
  });

  ipcMain.on('profiles.reload', async () => {
    log.info("reload " + PROFILES_JSON);
    try {
      const data = await configService.load(PROFILES_JSON, true);
      mainWindow.webContents.send("profiles.loaded", data);
      log.info(PROFILES_JSON + " reloaded");
    } catch (err) {
      log.error(err);
    }
  });

  ipcMain.on('profiles.save', (event, obj) => {
    configService.save(PROFILES_JSON, obj.data, true)
      .then(() => {
        log.info('Profiles saved successfully!');
        configService.updateManifest('profiles.json');
      })
      .catch((error) => log.error('Error saving file:', error));
  });

  ipcMain.on('secrets.reload', async () => {
    log.info("reload " + SECRETS_JSON);
    try {
      if (reloadSecrets) {
        await reloadSecrets();
      } else {
        const data = await configService.load(SECRETS_JSON, true);
        mainWindow.webContents.send("secrets.loaded", data);
      }
      log.info(SECRETS_JSON + " reloaded");
    } catch (err) {
      log.error(err);
    }
  });

  ipcMain.on('secrets.save', (event, obj) => {
    configService.save(SECRETS_JSON, obj.data, true)
      .then(() => {
        log.info('Secrets saved successfully!');
        configService.updateManifest('secrets.json');
        if (reloadSecrets) {
          reloadSecrets();
        }
      })
      .catch((error) => log.error('Error saving file:', error));
  });

  ipcMain.on('cloud.reload', async () => {
    log.info("reload " + CLOUD_JSON);
    try {
      const data = await configService.load(CLOUD_JSON, true);
      mainWindow.webContents.send("cloud.loaded", data);
      log.info(CLOUD_JSON + " reloaded");
    } catch (err) {
      log.error(err);
    }
  });

  ipcMain.on('cloud.save', (event, obj) => {
    configService.save(CLOUD_JSON, obj.data, true)
      .then(() => {
        log.info('Cloud saved successfully!');
        configService.updateManifest('cloud.json');
      })
      .catch((error) => log.error('Error saving file:', error));
  });

  ipcMain.on('proxies.reload', async () => {
    log.info("reload " + PROXIES_JSON);
    try {
      if (reloadProxies) {
        await reloadProxies();
      } else {
        const data = await configService.load(PROXIES_JSON, true);
        mainWindow.webContents.send("proxies.loaded", data);
      }
      log.info(PROXIES_JSON + " reloaded");
    } catch (err) {
      log.error(err);
    }
  });

  ipcMain.on('proxies.save', (event, obj) => {
    configService.save(PROXIES_JSON, obj.data, true)
      .then(() => {
        log.info('Proxies saved successfully!');
        configService.updateManifest('proxies.json');
        if (reloadProxies) {
          reloadProxies();
        }
      })
      .catch((error) => log.error('Error saving file:', error));
  });
}

module.exports = { initConfigFilesIpcHandler };
