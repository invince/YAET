const {LocalTerminalSession} = require('./connectors/terminal/local');
const {ConfigService} = require('../services/configService');
const {ProxyService} = require('../services/proxyService');
const {decrypt} = require('../services/securityService');
const {ProfileService} = require('../services/profileService');

class RuntimeAPI {
  constructor(log) {
    this.log = log;
    this.configService = new ConfigService(log);
    this.secretRepo = null;
    this.proxyRepo = null;
    this._connectors = {};
    this._configResolvers = {};
  }

  registerConnector(profileType, factory) {
    this._connectors[profileType] = factory;
  }

  registerConfigResolver(profileType, resolverFn) {
    this._configResolvers[profileType] = resolverFn;
  }

  setSecretRepo(getter) {
    this.secretRepo = getter;
  }

  setProxyRepo(getter) {
    this.proxyRepo = getter;
  }

  /**
   * Map of old flat field names to profileType strings.
   * Used as fallback when reading profiles saved in the old format.
   */
  static OLD_FIELD_MAP = {
    sshProfile: 'SSH_TERMINAL',
    telnetProfile: 'TELNET_TERMINAL',
    winRmProfile: 'WIN_RM_TERMINAL',
    rdpProfile: 'RDP_REMOTE_DESKTOP',
    vncProfile: 'VNC_REMOTE_DESKTOP',
    ftpProfile: 'FTP_FILE_EXPLORER',
    sambaProfile: 'SAMBA_FILE_EXPLORER',
  };

  /**
   * Get the connection profile data from a profile object,
   * supporting both new (profileData) and old (flat fields) formats.
   */
  _getConnProfile(profile) {
    const profileType = profile.profileType || '';
    // New format: profileData[profileType]
    if (profile.profileData && profile.profileData[profileType]) {
      return profile.profileData[profileType];
    }
    // Old format: flat field like profile.sshProfile
    for (const [oldField, pt] of Object.entries(RuntimeAPI.OLD_FIELD_MAP)) {
      if (pt === profileType && profile[oldField]) {
        return profile[oldField];
      }
    }
    // Aggressive fallback: try any old field that has a host or share.
    // P2-4: this can connect to the WRONG host when a profile carries stale
    // flat fields — log loudly so it gets migrated instead of silently used.
    for (const oldField of Object.keys(RuntimeAPI.OLD_FIELD_MAP)) {
      if (profile[oldField] && (profile[oldField].host || profile[oldField].share)) {
        if (this.log) this.log.warn(`Profile ${profile.id || '?'} (${profile.name || '?'}) resolved via legacy fallback field '${oldField}' — migrate it to profileData format`);
        return profile[oldField];
      }
    }
    return null;
  }

  /**
   * Extract a human-readable host identifier from a profile.
   */
  _getHostFromProfile(p) {
    const conn = this._getConnProfile(p);
    return conn ? (conn.host || conn.share || '') : '';
  }

  async listProfiles(keyword) {
    const encrypted = await this.configService.getProfiles();
    if (!encrypted) return {profiles: []};

    const decrypted = await decrypt(encrypted);
    const data = JSON.parse(decrypted);
    const profiles = data.profiles || [];

    const kw = keyword ? keyword.toLowerCase() : '';

    const safe = profiles
      .filter(p => {
        if (!kw) return true;
        const name = (p.name || '').toLowerCase();
        return name.includes(kw);
      })
      .map(p => {
        // P0-1: expose only routing-neutral identity. No host/port/share,
        // no login/password/secretId/proxyId — AI resolves via profileId only.
        return {
          id: p.id,
          name: p.name || '',
          type: p.profileType || '',
        };
      });

    return {profiles: safe};
  }

  /** Resolve SSH config by profile name (for MCP/ACP external adapters) */
  async resolveSSHConfigByName(profileName) {
    if (!this._profileService) {
      this._profileService = new ProfileService(this.log);
    }
    return this._profileService.resolveSSHConfigByName(profileName);
  }

  /** Resolve SSH config by profile ID */
  async resolveSSHConfigById(profileId) {
    if (!this._profileService) {
      this._profileService = new ProfileService(this.log);
    }
    return this._profileService.resolveSSHConfigById(profileId);
  }

  /** List all SSH profiles (for tools/list discovery) */
  async listSSHProfiles() {
    if (!this._profileService) {
      this._profileService = new ProfileService(this.log);
    }
    return this._profileService.listSSHProfiles();
  }

  async getConnector(profileId, options = {}) {
    if (!profileId) {
      return new LocalTerminalSession(this.log);
    }

    const encrypted = await this.configService.getProfiles();
    if (!encrypted) throw new Error('No profiles found');

    const decrypted = await decrypt(encrypted);
    const data = JSON.parse(decrypted);
    const profile = data.profiles?.find(p => p.id === profileId);
    if (!profile) throw new Error(`Profile not found: ${profileId}`);

    const profileType = profile.profileType || '';

    if (profileType === 'LOCAL_TERMINAL') {
      return new LocalTerminalSession(this.log);
    }

    if (profileType === 'RDP_REMOTE_DESKTOP') {
      throw new Error(`Connector ${profileType} not supported for runtime operations`);
    }

    const config = await this._resolveRemoteConfig(profileId, options);

    if (this._connectors[profileType]) {
      return this._connectors[profileType](this.log, config);
    }

    throw new Error(`Unsupported profile type for connector: ${profileType}`);
  }

  async _resolveRemoteConfig(profileId, options = {}) {
    const encrypted = await this.configService.getProfiles();
    if (!encrypted) throw new Error('No profiles found');

    const decrypted = await decrypt(encrypted);
    const data = JSON.parse(decrypted);
    const profiles = data.profiles || [];
    const profile = profiles.find(p => p.id === profileId);
    if (!profile) throw new Error(`Profile not found: ${profileId}`);

    const profileType = profile.profileType || '';

    // Read connection profile — supports both new (profileData) and old (flat fields) formats
    let connProfile = this._getConnProfile(profile);

    if (!connProfile) throw new Error(`Profile ${profileId} has no remote connection configuration`);

    // P0-1: AI must not override secrets/proxy. options.secretId/options.proxyId
    // are IGNORED here — only profile-bound connProfile.secretId and
    // profile.proxyId are used. Custom resolvers receive the same bound values.
    const boundSecretId = connProfile.secretId;
    const boundProxyId = profile.proxyId || '';

    // Check if a plugin registered a custom config resolver for this type
    if (this._configResolvers[profileType]) {
      return this._configResolvers[profileType](connProfile, {
        secretId: boundSecretId,
        proxyId: boundProxyId,
        secretRepo: this.secretRepo,
        proxyRepo: this.proxyRepo,
        log: this.log,
      });
    }

    // Generic config for standard types (SSH, SCP)
    if (!connProfile.host) throw new Error(`Profile ${profile.id || ''} has no host configured`);

    const config = {
      host: connProfile.host,
      port: connProfile.port || 22,
    };

    const secretId = boundSecretId;
    if (connProfile.authType === 'login' || connProfile.authType === 'LOGIN') {
      config.username = connProfile.login;
      config.password = connProfile.password;
    } else if (connProfile.authType === 'secret' || connProfile.authType === 'SECRET') {
      const secrets = this.secretRepo ? this.secretRepo() : null;
      if (!secrets || !secrets.secrets) throw new Error('No secrets loaded');

      if (!secretId) throw new Error(`Profile ${profile.id || ''} has no secretId`);

      const secret = secrets.secrets.find(s => s.id === secretId);
      if (!secret) throw new Error(`Secret not found: ${secretId}`);

      const secretType = secret.secretType || '';
      if (secretType === 'LOGIN_PASSWORD' || secretType === 'login_password') {
        config.username = secret.login;
        config.password = secret.password;
      } else if (secretType === 'SSH_KEY' || secretType === 'ssh_key') {
        config.username = secret.login;
        config.privateKey = (secret.key || '').replace(/\\n/g, '\n');
        if (secret.passphrase) {
          config.passphrase = secret.passphrase;
        }
      } else if (secretType === 'PASSWORD_ONLY' || secretType === 'password_only') {
        config.password = secret.password;
        if (secret.login) {
          config.username = secret.login;
        }
      }
    } else {
      if (connProfile.login) {
        config.username = connProfile.login;
      }
    }

    if (boundProxyId) {
      const proxies = this.proxyRepo ? this.proxyRepo() : null;
      if (!proxies || !proxies.proxies) throw new Error('No proxies loaded');

      const proxy = proxies.proxies.find(p => p.id === boundProxyId);
      if (!proxy) throw new Error(`Proxy not found: ${boundProxyId}`);

      const proxyService = new ProxyService(this.log);
      const secrets = this.secretRepo ? this.secretRepo() : null;
      const sock = await proxyService.createProxyConnection(
        proxy,
        config.host,
        config.port,
        () => secrets || {secrets: []}
      );
      config.sock = sock;
    }

    return config;
  }
}

module.exports = {RuntimeAPI};
