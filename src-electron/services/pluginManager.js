const path = require('path');
const fs = require('fs');
const os = require('os');
const crypto = require('crypto');
const {execSync} = require('child_process');
const { getAppConfigPath } = require('./envConfig');

/**
 * PluginManager — discovers and loads backend plugins.
 *
 * Scans two directories for plugins:
 *   1. Bundled:  <appRoot>/../plugins/        (shipped with the app)
 *   2. External: <configDir>/plugins/          (user-installed; ~/.yaet in
 *      production, ~/.yaet-debug under NODE_ENV=development — see envConfig.js)
 *
 * External plugins with the same id as a bundled plugin are SKIPPED (security).
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

    // External plugins (user-installed at <configDir>/plugins/)
    this.externalDir = path.join(getAppConfigPath(), 'plugins');

    // User-controlled enabled list for external plugins
    this.enabledListPath = path.join(this.externalDir, 'enabled.json');

    /** Stored from last loadAll() call, reused by reloadExternal() */
    this._lastContext = null;

    // Load the enabled list
    this._enabledList = this._loadEnabledList();
  }

  /**
   * Load the user-controlled enabled plugins list from disk.
   * Format: { "plugin-id": true | { enabled: true, hash: "..." }, ... }
   */
  _loadEnabledList() {
    try {
      if (fs.existsSync(this.enabledListPath)) {
        const raw = fs.readFileSync(this.enabledListPath, 'utf-8');
        const parsed = JSON.parse(raw);
        if (typeof parsed === 'object' && parsed !== null) {
          // Normalize: convert `true` to `{ enabled: true }` for consistency
          const normalized = {};
          for (const [key, val] of Object.entries(parsed)) {
            if (val === true) {
              normalized[key] = {enabled: true};
            } else if (typeof val === 'object' && val !== null) {
              normalized[key] = val;
            }
          }
          return normalized;
        }
      }
    } catch {}
    return {};
  }

  /**
   * Save the enabled list to disk.
   */
  _saveEnabledList() {
    try {
      const dir = path.dirname(this.enabledListPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, {recursive: true});
      }
      fs.writeFileSync(this.enabledListPath, JSON.stringify(this._enabledList, null, 2), 'utf-8');
    } catch (err) {
      this.logger.warn(`[PluginManager] Could not save enabled list: ${err.message}`);
    }
  }

  /**
   * Enable an external plugin. Adds it to the user-controlled enabled list
   * and stores the manifest hash for integrity verification.
   * @param {string} id - Plugin ID
   * @param {Object} [manifest] - Plugin manifest to hash (optional, for hash storage)
   */
  enablePlugin(id, manifest) {
    const entry = {enabled: true};
    if (manifest) {
      entry.hash = this._computeManifestHash(manifest);
    }
    this._enabledList[id] = entry;
    this._saveEnabledList();
  }

  /**
   * Disable an external plugin. Removes it from the user-controlled enabled list.
   */
  disablePlugin(id) {
    delete this._enabledList[id];
    this._saveEnabledList();
  }

  // ── Manifest integrity verification (P0-S4 Phase 2) ────────────────────

  /**
   * Compute SHA-256 hash of a manifest object.
   * Excludes _hash and _hmac fields to avoid circular dependency.
   */
  _computeManifestHash(manifest) {
    const clean = {...manifest};
    delete clean._hash;
    delete clean._hmac;
    const content = JSON.stringify(clean, Object.keys(clean).sort());
    return crypto.createHash('sha256').update(content).digest('hex');
  }

  /**
   * Compute HMAC-SHA256 of a manifest using a key.
   */
  _computeManifestHmac(manifest, key) {
    const clean = {...manifest};
    delete clean._hash;
    delete clean._hmac;
    const content = JSON.stringify(clean, Object.keys(clean).sort());
    return crypto.createHmac('sha256', key).update(content).digest('hex');
  }

  /**
   * Verify manifest integrity against stored hash.
   * Returns { valid: boolean, reason?: string }
   */
  _verifyManifestIntegrity(id, manifest, source) {
    // Compute current hash
    const currentHash = this._computeManifestHash(manifest);

    if (source === 'bundled') {
      // Bundled plugins: verify against pre-computed hashes file
      const hashesPath = path.join(this.bundledDir, 'manifest-hashes.json');
      try {
        if (fs.existsSync(hashesPath)) {
          const hashes = JSON.parse(fs.readFileSync(hashesPath, 'utf-8'));
          if (hashes[id] && hashes[id] !== currentHash) {
            return {valid: false, reason: `Bundled plugin "${id}" manifest hash mismatch — possible tampering`};
          }
        }
      } catch {}
    } else if (source === 'external') {
      // External plugins: verify against hash stored when enabled
      const enabledEntry = this._enabledList[id];
      if (enabledEntry && typeof enabledEntry === 'object' && enabledEntry.hash) {
        if (enabledEntry.hash !== currentHash) {
          return {valid: false, reason: `External plugin "${id}" manifest hash mismatch — possible tampering after enable`};
        }
      }
    }

    return {valid: true, hash: currentHash};
  }

  /**
   * Verify optional HMAC signature on a manifest.
   * Requires user-provided signing key in <configDir>/signing.key
   * Returns { valid: boolean, reason?: string }
   */
  _verifyManifestHmac(manifest, pluginDir) {
    if (!manifest._hmac) return {valid: true}; // No HMAC = skip verification

    const signingKeyPath = path.join(getAppConfigPath(), 'signing.key');
    try {
      if (!fs.existsSync(signingKeyPath)) {
        return {valid: false, reason: `Plugin declares HMAC signature but no signing key found at ${signingKeyPath}`};
      }
      const key = fs.readFileSync(signingKeyPath, 'utf-8').trim();
      const expected = this._computeManifestHmac(manifest, key);
      if (expected !== manifest._hmac) {
        return {valid: false, reason: `Plugin HMAC signature verification failed`};
      }
      return {valid: true};
    } catch (err) {
      return {valid: false, reason: `HMAC verification error: ${err.message}`};
    }
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
          if (source === 'external') {
            this.logger.warn(`[PluginManager] External plugin "${manifest.id}" blocked — id conflicts with bundled plugin`);
            continue;
          }
          this.logger.info(`[PluginManager] Bundled plugin overrides previous: ${manifest.id}`);
        }

        // P0-S4: External plugins default to disabled unless explicitly enabled
        // by the user in ~/.yaet/plugins/enabled.json
        if (source === 'external') {
          const enabledEntry = this._enabledList[manifest.id];
          manifest.enabled = !!(enabledEntry && (enabledEntry.enabled !== false));
          if (!manifest.enabled) {
            this.logger.info(`[PluginManager] External plugin "${manifest.id}" is not enabled — skipping (use enablePlugin() to enable)`);
          }
        }

        // P0-S4 Phase 2: Verify manifest integrity
        const integrity = this._verifyManifestIntegrity(manifest.id, manifest, source);
        if (!integrity.valid) {
          this.logger.error(`[PluginManager] ${integrity.reason}`);
          if (source === 'external') {
            continue; // Skip tampered external plugins
          }
          // For bundled plugins, warn but continue (may be dev mode)
          this.logger.warn(`[PluginManager] Continuing despite hash mismatch (bundled plugin)`);
        }

        // P0-S4 Phase 2: Verify optional HMAC signature
        const hmacResult = this._verifyManifestHmac(manifest, path.join(dir, entry.name));
        if (!hmacResult.valid) {
          this.logger.error(`[PluginManager] ${hmacResult.reason}`);
          if (source === 'external') {
            continue; // Skip plugins with invalid HMAC
          }
        }

        this.plugins.set(manifest.id, {
          manifest,
          loaded: false,
          module: null,
          source,
          baseDir: dir,
        });

        this.logger.info(`[PluginManager] Discovered ${source} plugin: ${manifest.id} v${manifest.version} (enabled: ${manifest.enabled})`);

        // Auto-install plugin dependencies if package.json exists
        // (with --ignore-scripts for security)
        this._installPluginDeps(path.join(dir, entry.name));
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
    this._lastContext = context;
    for (const [id, plugin] of this.plugins) {
      if (!plugin.manifest.enabled) {
        this.logger.info(`[PluginManager] Plugin ${id} is disabled, skipping`);
        continue;
      }
      this._loadPlugin(id, plugin, context);
    }
  }

  /**
   * Rescan the external plugin directory and load any newly discovered plugins.
   * Already-loaded plugins are kept (Node.js module cache prevents true unload).
   */
  reloadExternal() {
    const context = this._lastContext;
    if (!context) {
      this.logger.warn('[PluginManager] No context available for reload');
      return;
    }

    // Remove IPC handlers for previously loaded external plugins before re-registering
    for (const [, plugin] of this.plugins) {
      if (plugin.source === 'external' && plugin.loaded) {
        this._removePluginHandlers(plugin);
      }
    }

    // Forget previously discovered external plugins so _scanDirectory re-adds them
    for (const [id, plugin] of this.plugins) {
      if (plugin.source === 'external') {
        this.plugins.delete(id);
      }
    }

    this._scanDirectory(this.externalDir, 'external');

    for (const [id, plugin] of this.plugins) {
      if (plugin.source === 'external' && !plugin.loaded) {
        this._loadPlugin(id, plugin, context);
      }
    }

    this.writeMergedManifest();
    this.logger.info('[PluginManager] External plugins reloaded');
  }

  /**
   * Remove previously registered IPC handlers for a plugin (so re-registration works on reload).
   */
  _removePluginHandlers(plugin) {
    const ipc = plugin.manifest.ipc || {};
    const {ipcMain} = require('electron');
    const invokeChannels = ipc.invoke || [];
    for (const ch of invokeChannels) {
      try { ipcMain.removeHandler(ch); } catch {}
    }
  }

  /**
   * Run npm install in the plugin directory if package.json exists
   * and node_modules is missing (or package.json is newer).
   * Uses --ignore-scripts to prevent postinstall hook execution (P0-S4).
   */
  _installPluginDeps(pluginDir) {
    const pkgPath = path.join(pluginDir, 'package.json');
    if (!fs.existsSync(pkgPath)) return;

    const nmPath = path.join(pluginDir, 'node_modules');
    if (fs.existsSync(nmPath)) {
      // Skip if node_modules already exists and is newer than package.json
      try {
        const pkgMtime = fs.statSync(pkgPath).mtimeMs;
        const nmMtime = fs.statSync(nmPath).mtimeMs;
        if (nmMtime >= pkgMtime) return;
      } catch {}
    }

    this.logger.info(`[PluginManager] Installing deps for plugin: ${path.basename(pluginDir)}`);
    try {
      execSync('npm install --ignore-scripts', {
        cwd: pluginDir,
        stdio: 'pipe',
        timeout: 60000,
      });
      this.logger.info(`[PluginManager] Deps installed for: ${path.basename(pluginDir)}`);
    } catch (err) {
      this.logger.warn(`[PluginManager] npm install failed for ${path.basename(pluginDir)}: ${err.message}`);
    }
  }

  /**
   * Load a single plugin's backend module.
   */
  _loadPlugin(id, plugin, context) {
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

    // Build restricted context — capability-based security (P0-S4)
    const allowedChannels = this._getAllowedChannels(plugin);
    const restrictedIpc = this._createRestrictedIpc(allowedChannels);
    const restrictedSecrets = this._createRestrictedSecrets(context.secretService, plugin.manifest);
    const restrictedRequire = this._createRestrictedRequire(projectRequire, plugin.manifest);
    const restrictedRuntime = this._createRestrictedRuntime(context.runtimeAPI, plugin.manifest);

    const pluginContext = {
      ...context,
      ipcMain: restrictedIpc,
      secretService: restrictedSecrets,
      runtimeAPI: restrictedRuntime,
      projectRequire: restrictedRequire,
      appRoot,
    };

    try {
      const backendModule = require(backendPath);

      if (typeof backendModule.register !== 'function') {
        this.logger.warn(`[PluginManager] Plugin ${id} has no register() function`);
        return;
      }

      backendModule.register(pluginContext);
      plugin.loaded = true;
      plugin.module = backendModule;

      this.logger.info(`[PluginManager] Loaded plugin: ${id} (${plugin.source})`);
    } catch (err) {
      this.logger.error(`[PluginManager] Failed to load plugin ${id}:`, err.message);
    }
  }

  /**
   * Get the set of IPC channels a plugin is allowed to register handlers for.
   * Only channels declared in the plugin's manifest are allowed.
   */
  _getAllowedChannels(plugin) {
    const ipc = plugin.manifest.ipc || {};
    return new Set([
      ...(ipc.send || []),
      ...(ipc.invoke || []),
      ...(ipc.on || []),
    ]);
  }

  /**
   * Create a restricted ipcMain-like object that only allows registering
   * handlers for channels declared in the plugin's manifest.
   */
  _createRestrictedIpc(allowedChannels) {
    const {ipcMain} = require('electron');
    const self = this;

    return {
      handle(channel, handler) {
        if (!allowedChannels.has(channel)) {
          self.logger.warn(`[PluginManager] Plugin blocked from registering undeclared channel: ${channel}`);
          return;
        }
        return ipcMain.handle(channel, handler);
      },
      on(channel, handler) {
        if (!allowedChannels.has(channel)) {
          self.logger.warn(`[PluginManager] Plugin blocked from listening on undeclared channel: ${channel}`);
          return;
        }
        return ipcMain.on(channel, handler);
      },
      removeHandler(channel) {
        return ipcMain.removeHandler(channel);
      },
      removeAllListeners(channel) {
        return ipcMain.removeAllListeners(channel);
      },
    };
  }

  /**
   * Create a restricted secretService that only returns secrets matching
   * the types declared in the plugin's manifest (secretTypes field).
   * Plugins cannot access secrets of undeclared types.
   */
  _createRestrictedSecrets(secretServiceGetter, manifest) {
    const allowedTypes = new Set(manifest.secretTypes || []);
    const self = this;

    function restrictedSecretService() {
      const allSecrets = secretServiceGetter();
      const allArray = allSecrets?.secrets || (Array.isArray(allSecrets) ? allSecrets : []);

      // Filter secrets by declared types only
      const filtered = allowedTypes.size > 0
        ? allArray.filter(s => allowedTypes.has(s.type))
        : [];

      return {
        secrets: filtered,
        findSecretById(id) {
          const found = allArray.find(s => s.id === id);
          if (found && !allowedTypes.has(found.type)) {
            self.logger.warn(`[PluginManager] Plugin denied access to secret "${found.name}" (type: ${found.type} not declared)`);
            return null;
          }
          return found || null;
        },
        findSecretByName(name) {
          const found = allArray.find(s => s.name === name);
          if (found && !allowedTypes.has(found.type)) {
            self.logger.warn(`[PluginManager] Plugin denied access to secret "${found.name}" (type: ${found.type} not declared)`);
            return null;
          }
          return found || null;
        },
      };
    }
    return restrictedSecretService;
  }

  /**
   * Create a restricted require function that only allows modules
   * declared in the plugin's manifest (dependencies field) + Node.js built-ins.
   */
  _createRestrictedRequire(baseRequire, manifest) {
    const allowedDeps = new Set(manifest.dependencies || []);
    const self = this;

    // Node.js built-in modules that are always allowed
    const builtins = new Set([
      'path', 'fs', 'fs/promises', 'os', 'crypto', 'events', 'stream',
      'url', 'util', 'child_process', 'net', 'http', 'https', 'tls',
      'zlib', 'buffer', 'string_decoder', 'timers', 'assert', 'querystring',
    ]);

    return function restrictedRequire(moduleName) {
      if (builtins.has(moduleName) || allowedDeps.has(moduleName)) {
        return baseRequire(moduleName);
      }
      self.logger.warn(`[PluginManager] Plugin blocked from requiring undeclared module: ${moduleName}`);
      throw new Error(`Module "${moduleName}" is not allowed — add it to manifest dependencies`);
    };
  }

  /**
   * Create a restricted runtimeAPI that only allows registering connectors
   * for the plugin's declared profileType.
   */
  _createRestrictedRuntime(runtimeAPIGetter, manifest) {
    const allowedProfileType = manifest.profileType;
    const self = this;

    return {
      registerConnector(type, factory) {
        if (type !== allowedProfileType) {
          self.logger.warn(`[PluginManager] Plugin blocked from registering connector for type "${type}" (declared: ${allowedProfileType})`);
          return;
        }
        const api = typeof runtimeAPIGetter === 'function' ? runtimeAPIGetter() : runtimeAPIGetter;
        if (api) {
          api.registerConnector(type, factory);
        }
      },
      registerConfigResolver(type, resolver) {
        if (type !== allowedProfileType) {
          self.logger.warn(`[PluginManager] Plugin blocked from registering config resolver for type "${type}" (declared: ${allowedProfileType})`);
          return;
        }
        const api = typeof runtimeAPIGetter === 'function' ? runtimeAPIGetter() : runtimeAPIGetter;
        if (api && typeof api.registerConfigResolver === 'function') {
          api.registerConfigResolver(type, resolver);
        }
      },
      // Pass through other methods as-is (they're read-only or scoped)
      getApprovalManager() {
        const api = typeof runtimeAPIGetter === 'function' ? runtimeAPIGetter() : runtimeAPIGetter;
        return api?.getApprovalManager?.() || null;
      },
    };
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
   * - Bundled location: plugins/generated-plugin-manifest.json (for dev mode)
   * - External location: ~/.yaet/plugins/generated-plugin-manifest.json (for production)
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
      const frontend = plugin.manifest.frontend || {};
      // Compute frontend entry path relative to app root (for dynamic import)
      let frontendEntryPath = '';
      if (frontend.entry) {
        const pluginDir = path.join(plugin.baseDir, id);
        const entryAbs = path.resolve(pluginDir, frontend.entry);
        const appRoot = path.join(this.appRoot, '..');
        frontendEntryPath = path.relative(appRoot, entryAbs).replace(/\\/g, '/');
      }
      merged.plugins[id] = {
        name: plugin.manifest.name,
        version: plugin.manifest.version,
        category: plugin.manifest.category,
        profileType: plugin.manifest.profileType,
        source: plugin.source,
        openNewTab: plugin.manifest.openNewTab !== false,
        frontendEntry: frontendEntryPath,
        ipcChannels: {
          send: ipc.send || [],
          invoke: ipc.invoke || [],
          on: ipc.on || [],
        },
      };
    }

    const content = JSON.stringify(merged, null, 2);

    // Write to bundled location (for dev mode)
    const bundledPath = path.join(this.bundledDir, 'generated-plugin-manifest.json');
    this._writeIfDirExists(bundledPath, content);

    // Write to external location (served to sandboxed preload via sync IPC)
    const externalDir = getAppConfigPath();
    if (!fs.existsSync(externalDir)) {
      fs.mkdirSync(externalDir, {recursive: true});
    }
    const externalPath = path.join(externalDir, 'plugins', 'generated-plugin-manifest.json');
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
      try {
        fs.writeFileSync(filePath, content, 'utf-8');
      } catch (err) {
        this.logger.warn(`[PluginManager] Could not write manifest to ${filePath}: ${err.message}`);
      }
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

  /**
   * Generate manifest-hashes.json for all bundled plugins.
   * Run this after modifying any bundled plugin manifest.
   * Can be called from CLI: node -e "require('./pluginManager').generateBundledHashes(__dirname, console)"
   */
  generateBundledHashes() {
    const hashes = {};
    if (!fs.existsSync(this.bundledDir)) return hashes;

    const entries = fs.readdirSync(this.bundledDir, {withFileTypes: true});
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const manifestPath = path.join(this.bundledDir, entry.name, 'manifest.json');
      if (!fs.existsSync(manifestPath)) continue;
      try {
        const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
        if (manifest.id) {
          hashes[manifest.id] = this._computeManifestHash(manifest);
        }
      } catch {}
    }

    const hashesPath = path.join(this.bundledDir, 'manifest-hashes.json');
    fs.writeFileSync(hashesPath, JSON.stringify(hashes, null, 2), 'utf-8');
    this.logger.info(`[PluginManager] Generated bundled manifest hashes: ${Object.keys(hashes).length} plugins`);
    return hashes;
  }
}

module.exports = {PluginManager};
