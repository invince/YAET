const path = require('path');
const fs = require('fs');
const os = require('os');

/**
 * PluginManager — discovers and loads backend plugins.
 *
 * Scans two directories for plugins:
 *   1. Bundled:  <appRoot>/../plugins/        (shipped with the app)
 *   2. External: ~/.yaet/plugins/              (user-installed, overrides bundled)
 *
 * External plugins with the same id as a bundled plugin will override it.
 *
 * Usage in electronMain.js:
 *   const pluginManager = new PluginManager(__dirname, log);
 *   pluginManager.discover();
 *   pluginManager.writeMergedManifest();  // before BrowserWindow creation
 *   pluginManager.loadAll(context);       // after core services are ready
 */
class PluginManager {
  /**
   * @param {string} appRoot - The src-electron/ directory (__dirname)
   * @param {Object} logger - electron-log instance
   */
  constructor(appRoot, logger) {
    this.appRoot = appRoot;
    this.logger = logger;
    this.plugins = new Map(); // id -> { manifest, loaded, module, source }

    // Bundled plugins (shipped with the app)
    this.bundledDir = path.join(appRoot, '..', 'plugins');

    // External plugins (user-installed at ~/.yaet/plugins/)
    this.externalDir = path.join(os.homedir(), '.yaet', 'plugins');
  }

  /**
   * Scan both bundled and external plugin directories.
   * External plugins override bundled ones with the same id.
   */
  discover() {
    // 1. Discover bundled plugins first
    this._scanDirectory(this.bundledDir, 'bundled');

    // 2. Discover external plugins (overrides bundled)
    this._scanDirectory(this.externalDir, 'external');
  }

  /**
   * Scan a single directory for plugins.
   * @param {string} dir - Directory to scan
   * @param {string} source - 'bundled' or 'external'
   */
  _scanDirectory(dir, source) {
    if (!fs.existsSync(dir)) {
      if (source === 'bundled') {
        this.logger.warn(`[PluginManager] Bundled plugins directory not found: ${dir}`);
      }
      return;
    }

    const entries = fs.readdirSync(dir, {withFileTypes: true});
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      if (entry.name.startsWith('.')) continue; // skip hidden dirs

      const manifestPath = path.join(dir, entry.name, 'manifest.json');
      if (!fs.existsSync(manifestPath)) continue;

      try {
        const raw = fs.readFileSync(manifestPath, 'utf-8');
        const manifest = JSON.parse(raw);

        if (!manifest.id || !manifest.category || !manifest.profileType) {
          this.logger.warn(`[PluginManager] Invalid manifest in ${entry.name}, skipping`);
          continue;
        }

        const existing = this.plugins.get(manifest.id);
        if (existing) {
          this.logger.info(`[PluginManager] External plugin overrides bundled: ${manifest.id}`);
        }

        this.plugins.set(manifest.id, {
          manifest,
          loaded: false,
          module: null,
          source,
          baseDir: dir,
        });

        this.logger.info(`[PluginManager] Discovered ${source} plugin: ${manifest.id} v${manifest.version}`);
      } catch (err) {
        this.logger.error(`[PluginManager] Failed to parse manifest in ${entry.name}:`, err.message);
      }
    }
  }

  /**
   * Load all enabled plugins.
   * @param {Object} context - Shared context passed to all plugins
   */
  loadAll(context) {
    for (const [id, plugin] of this.plugins) {
      if (!plugin.manifest.enabled) {
        this.logger.info(`[PluginManager] Plugin ${id} is disabled, skipping`);
        continue;
      }
      this._loadPlugin(id, plugin, context);
    }
  }

  /**
   * Load a single plugin's backend module.
   */
  _loadPlugin(id, plugin, context) {
    if (plugin.loaded) return;

    const backendRelative = plugin.manifest.backend || './backend/index.js';
    const backendPath = path.join(plugin.baseDir, id, backendRelative);

    if (!fs.existsSync(backendPath)) {
      this.logger.warn(`[PluginManager] Backend entry not found for ${id}: ${backendPath}`);
      return;
    }

    // Provide a require function rooted at the project root so external plugins
    // can resolve npm deps (like ssh2) from the project's node_modules
    const appRoot = path.join(this.appRoot, '..');
    const {createRequire} = require('module');
    const projectRequire = createRequire(path.join(appRoot, 'noop.js'));
    context.projectRequire = projectRequire;
    context.appRoot = appRoot;

    try {
      const backendModule = require(backendPath);

      if (typeof backendModule.register !== 'function') {
        this.logger.warn(`[PluginManager] Plugin ${id} has no register() function`);
        return;
      }

      backendModule.register(context);
      plugin.loaded = true;
      plugin.module = backendModule;

      this.logger.info(`[PluginManager] Loaded plugin: ${id} (${plugin.source})`);
    } catch (err) {
      this.logger.error(`[PluginManager] Failed to load plugin ${id}:`, err.message);
    }
  }

  /**
   * Get all IPC channels declared by enabled plugins.
   */
  getAllIpcChannels() {
    const channels = {send: [], invoke: [], on: []};

    for (const [, plugin] of this.plugins) {
      if (!plugin.manifest.enabled) continue;
      const ipc = plugin.manifest.ipc || {};
      if (ipc.send) channels.send.push(...ipc.send);
      if (ipc.invoke) channels.invoke.push(...ipc.invoke);
      if (ipc.on) channels.on.push(...ipc.on);
    }

    channels.send = [...new Set(channels.send)];
    channels.invoke = [...new Set(channels.invoke)];
    channels.on = [...new Set(channels.on)];

    return channels;
  }

  /**
   * Write merged manifest to BOTH locations so preload.js can read it.
   * - Bundled location: plugins/.plugin-manifest.json (for dev mode)
   * - External location: ~/.yaet/plugins/.plugin-manifest.json (for production)
   */
  writeMergedManifest() {
    const merged = {
      version: 1,
      plugins: {},
      ipc: this.getAllIpcChannels(),
    };

    for (const [id, plugin] of this.plugins) {
      if (!plugin.manifest.enabled) continue;
      const ipc = plugin.manifest.ipc || {};
      merged.plugins[id] = {
        name: plugin.manifest.name,
        version: plugin.manifest.version,
        category: plugin.manifest.category,
        profileType: plugin.manifest.profileType,
        source: plugin.source,
        ipcChannels: {
          send: ipc.send || [],
          invoke: ipc.invoke || [],
          on: ipc.on || [],
        },
      };
    }

    const content = JSON.stringify(merged, null, 2);

    // Write to bundled location (for dev mode)
    const bundledPath = path.join(this.bundledDir, '.plugin-manifest.json');
    this._writeIfDirExists(bundledPath, content);

    // Write to external location (for production — preload.js reads from here)
    const externalDir = path.join(os.homedir(), '.yaet');
    if (!fs.existsSync(externalDir)) {
      fs.mkdirSync(externalDir, {recursive: true});
    }
    const externalPath = path.join(externalDir, 'plugins', '.plugin-manifest.json');
    const extDir = path.dirname(externalPath);
    if (!fs.existsSync(extDir)) {
      fs.mkdirSync(extDir, {recursive: true});
    }
    fs.writeFileSync(externalPath, content, 'utf-8');

    this.logger.info(`[PluginManager] Wrote merged manifest`);
  }

  _writeIfDirExists(filePath, content) {
    const dir = path.dirname(filePath);
    if (fs.existsSync(dir)) {
      fs.writeFileSync(filePath, content, 'utf-8');
    }
  }

  /**
   * Get all discovered plugins (for the plugin manager UI).
   */
  getPluginList() {
    const list = [];
    for (const [id, plugin] of this.plugins) {
      list.push({
        id,
        name: plugin.manifest.name,
        version: plugin.manifest.version,
        description: plugin.manifest.description,
        category: plugin.manifest.category,
        profileType: plugin.manifest.profileType,
        enabled: plugin.manifest.enabled,
        loaded: plugin.loaded,
        source: plugin.source,
      });
    }
    return list;
  }
}

module.exports = {PluginManager};
