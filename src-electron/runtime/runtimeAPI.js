const {SshTerminalSession} = require('./connectors/terminal/ssh');
const {LocalTerminalSession} = require('./connectors/terminal/local');
const {TelnetSession} = require('./connectors/terminal/telnet');
const {WinRMSession} = require('./connectors/terminal/winrm');
const {ScpFileExplorer} = require('./connectors/file/scp');
const {ConfigService} = require('../services/configService');
const {ProxyService} = require('../services/proxyService');
const {decrypt} = require('../adapter/ui-ipc/security');

class RuntimeAPI {
  constructor(log) {
    this.log = log;
    this.configService = new ConfigService(log);
    this.secretRepo = null;
    this.proxyRepo = null;
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
        const host = p.sshProfile?.host || p.telnetProfile?.host || p.winRmProfile?.host || '';
        return name.includes(kw) || host.includes(kw);
      })
      .map(p => {
        const profile = p.profileType === 'TELNET_TERMINAL' ? p.telnetProfile
          : p.profileType === 'WIN_RM_TERMINAL' ? p.winRmProfile
            : p.sshProfile;
        return {
          id: p.id,
          name: p.name || '',
          type: p.profileType || '',
          host: profile?.host || '',
          port: profile?.port || -1,
        };
      });

    return {profiles: safe};
  }

  async getConnector(profileId, options = {}) {
    const config = await this._resolveRemoteConfig(profileId, options);
    const encrypted = await this.configService.getProfiles();
    if (!encrypted) throw new Error('No profiles found');

    const decrypted = await decrypt(encrypted);
    const data = JSON.parse(decrypted);
    const profile = data.profiles?.find(p => p.id === profileId);
    if (!profile) throw new Error(`Profile not found: ${profileId}`);

    const profileType = profile.profileType || '';

    switch (profileType) {
      case 'SSH_TERMINAL':
        return new SshTerminalSession(this.log, config);
      case 'TELNET_TERMINAL':
        return new TelnetSession(this.log, config);
      case 'WIN_RM_TERMINAL':
        return new WinRMSession(this.log, config);
      case 'SCP_FILE_EXPLORER':
        return new ScpFileExplorer(this.log, config);
      case 'LOCAL_TERMINAL':
        return new LocalTerminalSession(this.log);
      case 'FTP_FILE_EXPLORER':
        throw new Error(`Connector ${profileType} not implemented yet`);
      case 'SAMBA_FILE_EXPLORER':
        throw new Error(`Connector ${profileType} not implemented yet`);
      case 'VNC_REMOTE_DESKTOP':
        throw new Error(`Connector ${profileType} not implemented yet`);
      case 'RDP_REMOTE_DESKTOP':
        throw new Error(`Connector ${profileType} not implemented yet`);
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

    const connProfile = profile.sshProfile?.host ? profile.sshProfile
      : profile.telnetProfile?.host ? profile.telnetProfile
        : profile.winRmProfile?.host ? profile.winRmProfile
          : null;
    if (!connProfile) throw new Error(`Profile ${profileId} has no remote connection configuration`);
    if (!connProfile.host) throw new Error(`Profile ${profileId} has no host configured`);

    const defaultPort = profile.profileType === 'TELNET_TERMINAL' ? 23
      : profile.profileType === 'WIN_RM_TERMINAL' ? 5985
        : 22;
    const config = {
      host: connProfile.host,
      port: connProfile.port || defaultPort,
    };

    if (profile.profileType === 'TELNET_TERMINAL') {
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
