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
    const bundledPath = path.join(__dirname, '..', '..', 'plugins', 'generated-plugin-manifest.json');
    const externalPath = path.join(os.homedir(), '.yaet', 'plugins', 'generated-plugin-manifest.json');
    const manifestPath = fs.existsSync(externalPath) ? externalPath : bundledPath;
    if (!fs.existsSync(manifestPath)) return null;
    try {
      return JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
    } catch {
      return null;
    }
  });

  ipcMain.handle('plugins.reloadExternal', () => {
    pluginManager.reloadExternal();
  });

  ipcMain.handle('plugins.getExternalDir', () => {
    return path.join(os.homedir(), '.yaet', 'plugins');
  });

  ipcMain.handle('plugins.readFrontend', (event, pluginId) => {
    // P0-S7: pluginId=../../.. used to read arbitrary files (then executed
    // via executePluginCode). Validate against discovered IDs + charset +
    // resolved-path containment — all three, belt and suspenders.
    const id = String(pluginId || '');
    if (!/^[A-Za-z0-9_-]{1,64}$/.test(id)) {
      log.warn(`Rejected suspicious plugin id: ${id}`);
      return null;
    }
    const known = new Set((pluginManager.getPluginList() || []).map(p => p && p.id));
    if (!known.has(id)) {
      log.warn(`Rejected unknown plugin id: ${id}`);
      return null;
    }
    const baseDir = path.resolve(os.homedir(), '.yaet', 'plugins');
    const filePath = path.resolve(baseDir, id, 'frontend', 'index.js');
    if (filePath !== path.join(baseDir, id, 'frontend', 'index.js') || !filePath.startsWith(baseDir + path.sep)) {
      log.warn(`Rejected escaping plugin path: ${id}`);
      return null;
    }
    if (!fs.existsSync(filePath)) return null;
    return fs.readFileSync(filePath, 'utf-8');
  });

  return pluginManager;
}

module.exports = { initPluginHandler };
