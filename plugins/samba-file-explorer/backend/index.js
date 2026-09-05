/**
 * Samba/CIFS File Explorer Plugin — Backend Entry (thin wrapper).
 *
 * Shared logic lives in src-electron/utils/fileExplorerBackendFactory.js.
 * Migrated from src-electron/adapter/ipc/file-explorer/sambaHandler.js
 */
const { SambaFileExplorer } = require('./samba');
const { registerFileExplorerBackend } = require('../../../src-electron/utils/fileExplorerBackendFactory');

function fixPath(pathParam) {
  let p = pathParam || '';
  if (p.endsWith('/')) p = p.slice(0, -1);
  if (p.startsWith('/')) p = p.slice(1);
  return p;
}

function sambaConfigResolver(connProfile, { secretId, secretRepo }) {
  const config = {
    share: connProfile.share,
    domain: connProfile.domain || 'WORKGROUP',
    username: connProfile.login || '',
    password: connProfile.password || '',
    port: connProfile.port || 445,
  };
  // Set host for proxy support
  const shareParts = (connProfile.share || '').split('/');
  config.host = shareParts[0] || '';
  const sid = secretId || connProfile.secretId;
  if ((connProfile.authType === 'secret' || connProfile.authType === 'SECRET' || secretId) && sid) {
    const secrets = typeof secretRepo === 'function' ? secretRepo() : secretRepo;
    if (secrets && secrets.secrets) {
      const secret = secrets.secrets.find(s => s.id === sid);
      if (secret) {
        if (secret.secretType === 'LOGIN_PASSWORD' || secret.secretType === 'login_password') {
          config.username = secret.login;
          config.password = secret.password;
        } else if (secret.secretType === 'PASSWORD_ONLY' || secret.secretType === 'password_only') {
          config.password = secret.password;
          if (secret.login) config.username = secret.login;
        }
      }
    }
  }
  return config;
}

function register(context) {
  registerFileExplorerBackend(context, {
    proto: 'samba',
    label: 'Samba',
    connectorType: 'SAMBA_FILE_EXPLORER',
    ipcChannel: 'session.fe.samba.register',
    ExplorerClass: SambaFileExplorer,
    defaultPort: 445,
    sockHost: (cfg) => cfg.share,
    configResolver: sambaConfigResolver,
    supportsSearch: false,
    fixPath,
    notFoundMessage: 'Error: connection config not found',
    tempDirName: 'samba-temp-files',
  });
}

module.exports = { register };
