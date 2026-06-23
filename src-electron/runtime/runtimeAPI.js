const {LocalTerminalSession} = require('./connectors/terminal/local');
const {ScpFileExplorer} = require('./connectors/file/scp');
const {FtpFileExplorer} = require('./connectors/file/ftp');
const {SambaFileExplorer} = require('./connectors/file/samba');
const {ConfigService} = require('../services/configService');
const {ProxyService} = require('../services/proxyService');
const {decrypt} = require('../services/securityService');

class RuntimeAPI {
  constructor(log) {
    this.log = log;
    this.configService = new ConfigService(log);
    this.secretRepo = null;
    this.proxyRepo = null;
    this._connectors = {};
  }

  registerConnector(profileType, factory) {
    this._connectors[profileType] = factory;
  }

  setSecretRepo(getter) {
    this.secretRepo = getter;
  }

  setProxyRepo(getter) {
    this.proxyRepo = getter;
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
        const host = p.sshProfile?.host || p.telnetProfile?.host || p.winRmProfile?.host || p.ftpProfile?.host || p.sambaProfile?.share || p.vncProfile?.host || '';
        return name.includes(kw) || host.includes(kw);
      })
      .map(p => {
        const profile = p.profileType === 'TELNET_TERMINAL' ? p.telnetProfile
          : p.profileType === 'WIN_RM_TERMINAL' ? p.winRmProfile
            : p.profileType === 'FTP_FILE_EXPLORER' ? p.ftpProfile
              : p.profileType === 'SAMBA_FILE_EXPLORER' ? p.sambaProfile
                : p.profileType === 'VNC_REMOTE_DESKTOP' ? p.vncProfile
                  : p.sshProfile;
        return {
          id: p.id,
          name: p.name || '',
          type: p.profileType || '',
          host: (profile && (profile.host || profile.share)) || '',
          port: profile?.port || -1,
        };
      });

    return {profiles: safe};
  }

  async getConnector(profileId, options = {}) {
    if (!profileId) {
      return new LocalTerminalSession(this.log);
    }

    const config = await this._resolveRemoteConfig(profileId, options);
    const encrypted = await this.configService.getProfiles();
    if (!encrypted) throw new Error('No profiles found');

    const decrypted = await decrypt(encrypted);
    const data = JSON.parse(decrypted);
    const profile = data.profiles?.find(p => p.id === profileId);
    if (!profile) throw new Error(`Profile not found: ${profileId}`);

    const profileType = profile.profileType || '';

    if (this._connectors[profileType]) {
      return this._connectors[profileType](this.log, config);
    }

    switch (profileType) {
      case 'SCP_FILE_EXPLORER':
        return new ScpFileExplorer(this.log, config);
      case 'LOCAL_TERMINAL':
        return new LocalTerminalSession(this.log);
      case 'FTP_FILE_EXPLORER':
        return new FtpFileExplorer(this.log, config);
      case 'SAMBA_FILE_EXPLORER':
        return new SambaFileExplorer(this.log, config);
      case 'RDP_REMOTE_DESKTOP':
        throw new Error(`Connector ${profileType} not supported for runtime operations`);
      case 'CUSTOM':
        throw new Error(`Connector ${profileType} not supported for runtime operations`);
      default:
        throw new Error(`Unsupported profile type for connector: ${profileType}`);
    }
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

    let connProfile;
    let defaultPort = 22;

    switch (profileType) {
      case 'SSH_TERMINAL':
      case 'SCP_FILE_EXPLORER':
        connProfile = profile.sshProfile; defaultPort = 22; break;
      case 'TELNET_TERMINAL':
        connProfile = profile.telnetProfile; defaultPort = 23; break;
      case 'WIN_RM_TERMINAL':
        connProfile = profile.winRmProfile; defaultPort = 5985; break;
      case 'FTP_FILE_EXPLORER':
        connProfile = profile.ftpProfile; defaultPort = 21; break;
      case 'SAMBA_FILE_EXPLORER':
        connProfile = profile.sambaProfile; defaultPort = 445; break;
      case 'VNC_REMOTE_DESKTOP':
        connProfile = profile.vncProfile; defaultPort = 5900; break;
      default:
        connProfile = profile.sshProfile?.host ? profile.sshProfile
          : profile.telnetProfile?.host ? profile.telnetProfile
            : profile.winRmProfile?.host ? profile.winRmProfile
              : null;
    }

    if (!connProfile) throw new Error(`Profile ${profileId} has no remote connection configuration`);

    if (profileType === 'FTP_FILE_EXPLORER') {
      const config = {
        host: connProfile.host,
        port: connProfile.port || 21,
        user: connProfile.login || 'anonymous',
        password: connProfile.password || 'guest',
        secure: connProfile.secured || false,
      };

      const secretId = options.secretId || connProfile.secretId;
      if (connProfile.authType === 'secret' || connProfile.authType === 'SECRET' || options.secretId) {
        const secrets = this.secretRepo ? this.secretRepo() : null;
        if (!secrets || !secrets.secrets) throw new Error('No secrets loaded');
        if (!secretId) throw new Error(`Profile ${profileId} has no secretId`);

        const secret = secrets.secrets.find(s => s.id === secretId);
        if (!secret) throw new Error(`Secret not found: ${secretId}`);

        const secretType = secret.secretType || '';
        if (secretType === 'LOGIN_PASSWORD' || secretType === 'login_password') {
          config.user = secret.login;
          config.password = secret.password;
        } else if (secretType === 'PASSWORD_ONLY' || secretType === 'password_only') {
          config.password = secret.password;
          if (secret.login) config.user = secret.login;
        }
      }

      return config;
    }

    if (profileType === 'SAMBA_FILE_EXPLORER') {
      const config = {
        share: connProfile.share,
        domain: connProfile.domain || 'WORKGROUP',
        username: connProfile.login || '',
        password: connProfile.password || '',
        port: connProfile.port || 445,
      };

      const secretId = options.secretId || connProfile.secretId;
      if (connProfile.authType === 'secret' || connProfile.authType === 'SECRET' || options.secretId) {
        const secrets = this.secretRepo ? this.secretRepo() : null;
        if (!secrets || !secrets.secrets) throw new Error('No secrets loaded');
        if (!secretId) throw new Error(`Profile ${profileId} has no secretId`);

        const secret = secrets.secrets.find(s => s.id === secretId);
        if (!secret) throw new Error(`Secret not found: ${secretId}`);

        const secretType = secret.secretType || '';
        if (secretType === 'LOGIN_PASSWORD' || secretType === 'login_password') {
          config.username = secret.login;
          config.password = secret.password;
        } else if (secretType === 'PASSWORD_ONLY' || secretType === 'password_only') {
          config.password = secret.password;
          if (secret.login) config.username = secret.login;
        }
      }

      return config;
    }

    if (profileType === 'VNC_REMOTE_DESKTOP') {
      return {
        host: connProfile.host,
        port: connProfile.port || 5900,
      };
    }

    if (!connProfile.host) throw new Error(`Profile ${profileId} has no host configured`);

    const config = {
      host: connProfile.host,
      port: connProfile.port || defaultPort,
    };

    if (profileType === 'TELNET_TERMINAL') {
      config.negotiationMandatory = false;
      config.timeout = 15000;
      config.loginPrompt = /[Ll]ogin|[Uu]ser(|name)[:\s]*$/i;
      config.passwordPrompt = /[Pp]ass(word|wd)?[:\s]*$/i;
    }

    const secretId = options.secretId || connProfile.secretId;
    if (connProfile.authType === 'login' || connProfile.authType === 'LOGIN') {
      config.username = connProfile.login;
      config.password = connProfile.password;
    } else if (connProfile.authType === 'secret' || connProfile.authType === 'SECRET' || options.secretId) {
      const secrets = this.secretRepo ? this.secretRepo() : null;
      if (!secrets || !secrets.secrets) throw new Error('No secrets loaded');

      if (!secretId) throw new Error(`Profile ${profileId} has no secretId`);

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

    if (options.proxyId) {
      const proxies = this.proxyRepo ? this.proxyRepo() : null;
      if (!proxies || !proxies.proxies) throw new Error('No proxies loaded');

      const proxy = proxies.proxies.find(p => p.id === options.proxyId);
      if (!proxy) throw new Error(`Proxy not found: ${options.proxyId}`);

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
