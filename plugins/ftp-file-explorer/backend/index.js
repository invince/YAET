/**
 * FTP File Explorer Plugin — Backend Entry (thin wrapper).
 *
 * Shared logic lives in src-electron/utils/fileExplorerBackendFactory.js.
 * Migrated from src-electron/adapter/ipc/file-explorer/ftpHandler.js
 */
const { FtpFileExplorer } = require('./ftp');
const { registerFileExplorerBackend } = require('../../../src-electron/utils/fileExplorerBackendFactory');

function ftpConfigResolver(connProfile, { secretId, secretRepo }) {
  const config = {
    host: connProfile.host,
    port: connProfile.port || 21,
    user: connProfile.login || 'anonymous',
    password: connProfile.password || 'guest',
    secure: connProfile.secured || false,
  };
  const sid = secretId || connProfile.secretId;
  if ((connProfile.authType === 'secret' || connProfile.authType === 'SECRET' || secretId) && sid) {
    const secrets = typeof secretRepo === 'function' ? secretRepo() : secretRepo;
    if (secrets && secrets.secrets) {
      const secret = secrets.secrets.find(s => s.id === sid);
      if (secret) {
        if (secret.secretType === 'LOGIN_PASSWORD' || secret.secretType === 'login_password') {
          config.user = secret.login;
          config.password = secret.password;
        } else if (secret.secretType === 'PASSWORD_ONLY' || secret.secretType === 'password_only') {
          config.password = secret.password;
          if (secret.login) config.user = secret.login;
        }
      }
    }
  }
  return config;
}

function register(context) {
  registerFileExplorerBackend(context, {
    proto: 'ftp',
    label: 'FTP',
    connectorType: 'FTP_FILE_EXPLORER',
    ipcChannel: 'session.fe.ftp.register',
    ExplorerClass: FtpFileExplorer,
    defaultPort: 21,
    sockHost: (cfg) => cfg.host,
    configResolver: ftpConfigResolver,
    buildUploadPath: (dir, file) => `${dir}/${file}`.replace(/\\/g, '/'),
    normalizeUploadBuffer: true,
    tempDirName: 'ftpHandler-temp-files',
  });
}

module.exports = { register };
