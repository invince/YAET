/**
 * SFTP File Explorer Plugin — Backend Entry (thin wrapper).
 *
 * Shared logic lives in src-electron/utils/fileExplorerBackendFactory.js.
 */
const { SftpFileExplorer } = require('./sftp');
const { registerFileExplorerBackend } = require('../../../src-electron/utils/fileExplorerBackendFactory');

// SFTP paths are POSIX-style concatenations (no path.join normalization).
const concatPath = (dir, name) => `${dir || ''}${name || ''}`;

function register(context) {
  registerFileExplorerBackend(context, {
    proto: 'sftp',
    label: 'SFTP',
    connectorType: 'SFTP_FILE_EXPLORER',
    ipcChannel: 'session.fe.sftp.register',
    ExplorerClass: SftpFileExplorer,
    defaultPort: 22,
    sockHost: (cfg) => cfg.host,
    enableBulkDownload: true,
    joinPath: concatPath,
    buildUploadPath: concatPath,
    openUploadViaStream: true,
    tempDirName: 'sftp-temp-files',
  });
}

module.exports = { register };
