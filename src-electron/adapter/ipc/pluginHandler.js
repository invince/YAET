const path = require('path');
const os = require('os');
const fs = require('fs');
const { PluginManager } = require('../../services/pluginManager');

let pluginManager = null;
let initialized = false;

// Example external plugins ship with the app under ext-plugins-example/ (they
// are "sources", not auto-discovered). Install = copy a subdir into
// ~/.yaet/plugins/<id>/. Only ids found in that source dir are ever allowed, so
// path traversal / arbitrary-copy is impossible.
function getExamplesDir() {
  // pluginManager.appRoot == <repo>/src-electron ; examples live one level up.
  return path.join(pluginManager.appRoot, '..', 'ext-plugins-example');
}

function discoverExamples() {
  const srcDir = getExamplesDir();
  if (!fs.existsSync(srcDir)) return [];
  const out = [];
  for (const name of fs.readdirSync(srcDir, { withFileTypes: true })) {
    if (!name.isDirectory()) continue;
    if (name.name.startsWith('.')) continue;
    const manifestPath = path.join(srcDir, name.name, 'manifest.json');
    if (!fs.existsSync(manifestPath)) continue;
    try {
      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
      if (!manifest.id) continue;
      out.push({
        id: manifest.id,
        name: manifest.name || name.name,
        version: manifest.version || '',
        description: manifest.description || '',
        category: manifest.category || '',
        profileType: manifest.profileType || '',
        icon: manifest.icon || 'extension',
        installed: fs.existsSync(path.join(pluginManager.externalDir, manifest.id)),
      });
    } catch {
      // skip malformed manifest
    }
  }
  return out;
}

function readMergedManifest() {
  const bundledPath = path.join(__dirname, '..', '..', 'plugins', 'generated-plugin-manifest.json');
  const externalPath = path.join(os.homedir(), '.yaet', 'plugins', 'generated-plugin-manifest.json');
  const manifestPath = fs.existsSync(externalPath) ? externalPath : bundledPath;
  if (!fs.existsSync(manifestPath)) return null;
  try {
    return JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
  } catch {
    return null;
  }
}

function initPluginHandler(log) {
  if (initialized) return pluginManager;
  initialized = true;

  pluginManager = new PluginManager(__dirname + '/../../', log);
  pluginManager.discover();
  pluginManager.writeMergedManifest();

  const { ipcMain } = require('electron');

  ipcMain.handle('plugins.list', () => pluginManager.getPluginList());

  ipcMain.handle('plugins.getMergedManifest', () => readMergedManifest());

  // P0-S3: sandboxed preload has no fs, so it fetches the plugin channel
  // allowlist synchronously at load time. initPluginHandler always runs (and
  // writeMergedManifest completes) before any renderer navigation commits,
  // so the file is fresh here; read from disk on every call to stay correct
  // across enable/disable hot-reloads.
  ipcMain.on('plugins.getMergedManifestSync', (event) => {
    const merged = readMergedManifest();
    event.returnValue = (merged && merged.ipc) || { send: [], invoke: [], on: [] };
  });

  ipcMain.handle('plugins.reloadExternal', () => {
    pluginManager.reloadExternal();
  });

  ipcMain.handle('plugins.getExternalDir', () => {
    return path.join(os.homedir(), '.yaet', 'plugins');
  });

  // ── Enable / Disable an external plugin ──────────────────────────────────
  // Enabling writes ~/.yaet/plugins/enabled.json + stores the manifest hash,
  // then hot-reloads so the plugin is usable immediately (no app restart).
  //
  // NB: _computeManifestHash hashes the whole manifest INCLUDING the `enabled`
  // field, but _scanDirectory rewrites manifest.enabled from _enabledList before
  // verifying integrity. So the hash stored at enable time must be computed from
  // an enabled=true manifest (matching what the next reload will verify against),
  // otherwise reload reports "manifest hash mismatch" and silently drops the
  // plugin from the list.
  ipcMain.handle('plugins.enable', (event, pluginId) => {
    const id = String(pluginId || '');
    const plugin = pluginManager.plugins.get(id);
    if (!plugin) {
      log.warn(`[PluginHandler] enable: unknown plugin id: ${id}`);
      return { ok: false, reason: 'unknown-plugin' };
    }
    if (plugin.source !== 'external') {
      // Bundled plugins are always on; nothing to enable.
      return { ok: false, reason: 'not-external' };
    }
    const manifestForHash = { ...plugin.manifest, enabled: true };
    pluginManager.enablePlugin(id, manifestForHash);
    pluginManager.reloadExternal();
    log.info(`[PluginHandler] Enabled external plugin: ${id}`);
    return { ok: true };
  });

  ipcMain.handle('plugins.disable', (event, pluginId) => {
    const id = String(pluginId || '');
    const plugin = pluginManager.plugins.get(id);
    if (!plugin) {
      return { ok: false, reason: 'unknown-plugin' };
    }
    if (plugin.source !== 'external') {
      return { ok: false, reason: 'not-external' };
    }
    pluginManager.disablePlugin(id);
    pluginManager.reloadExternal();
    log.info(`[PluginHandler] Disabled external plugin: ${id}`);
    return { ok: true };
  });

  // ── Install example plugins (from ext-plugins-example/) ──────────────────
  // Lists which examples ship with the app and whether each is already
  // installed in ~/.yaet/plugins/.
  ipcMain.handle('plugins.listExamples', () => discoverExamples());

  // Copy the chosen example subdirs into ~/.yaet/plugins/<id>/. Does NOT enable
  // them (external plugins stay disabled until the user hits Enable) — this is
  // intentional and matches the conservative P0-S4 security posture.
  ipcMain.handle('plugins.installExamples', (event, ids) => {
    const wanted = Array.isArray(ids) ? ids.map(String) : [];
    const examples = discoverExamples();
    const byId = new Map(examples.map(e => [e.id, e]));
    const srcDir = getExamplesDir();
    fs.mkdirSync(pluginManager.externalDir, { recursive: true });

    const installed = [];
    for (const id of wanted) {
      const ex = byId.get(id);
      if (!ex) {
        log.warn(`[PluginHandler] installExamples: not an example id, rejected: ${id}`);
        continue; // only ids from the shipped example dir are ever accepted
      }
      const src = path.join(srcDir, id);
      const dest = path.join(pluginManager.externalDir, id);
      if (fs.existsSync(dest)) {
        log.info(`[PluginHandler] installExamples: already installed, skip: ${id}`);
        installed.push({ id, ok: true, alreadyInstalled: true });
        continue;
      }
      try {
        fs.cpSync(src, dest, { recursive: true });
        log.info(`[PluginHandler] Installed example plugin: ${id}`);
        installed.push({ id, ok: true });
      } catch (err) {
        log.error(`[PluginHandler] Failed to install ${id}: ${err.message}`);
        installed.push({ id, ok: false, error: err.message });
      }
    }
    // Refresh discovery so newly copied plugins show up in the Settings list.
    pluginManager.reloadExternal();
    return { installed };
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
