const path = require('path');
const os = require('os');
const fs = require('fs');
const { PluginManager } = require('../../services/pluginManager');

let pluginManager = null;
let initialized = false;

function initPluginHandler(log) {
  if (initialized) return pluginManager;
  initialized = true;

  pluginManager = new PluginManager(__dirname + '/../../', log);
  pluginManager.discover();
  pluginManager.writeMergedManifest();

  const { ipcMain } = require('electron');

  ipcMain.handle('plugins.list', () => pluginManager.getPluginList());

  ipcMain.handle('plugins.getMergedManifest', () => {
    const bundledPath = path.join(__dirname, '..', '..', 'plugins', '.plugin-manifest.json');
    const externalPath = path.join(os.homedir(), '.yaet', 'plugins', '.plugin-manifest.json');
    const manifestPath = fs.existsSync(externalPath) ? externalPath : bundledPath;
    if (!fs.existsSync(manifestPath)) return null;
    try {
      return JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
    } catch {
      return null;
    }
  });

  ipcMain.handle('plugins.getExternalDir', () => {
    return path.join(os.homedir(), '.yaet', 'plugins');
  });

  ipcMain.handle('plugins.readFrontend', (event, pluginId) => {
    const filePath = path.join(os.homedir(), '.yaet', 'plugins', pluginId, 'frontend', 'index.js');
    if (!fs.existsSync(filePath)) return null;
    return fs.readFileSync(filePath, 'utf-8');
  });

  return pluginManager;
}

module.exports = { initPluginHandler };
