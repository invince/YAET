/**
 * SCP/SFTP File Explorer Plugin — Backend Entry (thin wrapper).
 *
 * Shared logic lives in src-electron/utils/fileExplorerBackendFactory.js.
 * Migrated from src-electron/adapter/ipc/file-explorer/scpHandler.js
 */
const { ScpFileExplorer } = require('./scp');
const { registerFileExplorerBackend } = require('../../../src-electron/utils/fileExplorerBackendFactory');

// SCP paths are POSIX-style concatenations (no path.join normalization).
const concatPath = (dir, name) => `${dir || ''}${name || ''}`;

function register(context) {
  registerFileExplorerBackend(context, {
    proto: 'scp',
    label: 'SCP',
    connectorType: 'SCP_FILE_EXPLORER',
    ipcChannel: 'session.fe.scp.register',
    ExplorerClass: ScpFileExplorer,
    defaultPort: 22,
    sockHost: (cfg) => cfg.host,
    enableBulkDownload: true,
    joinPath: concatPath,
    buildUploadPath: concatPath,
    openUploadViaStream: true,
    tempDirName: 'scp-temp-files',
  });
}

module.exports = { register };
