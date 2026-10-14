/**
 * IPC adapter for known_hosts management (A3).
 *
 * Channels (all allow-listed in preload.js CORE_INVOKE_CHANNELS):
 * - invoke 'known-hosts.list'   → [{ host, port, keyType, sha256, md5, randomart }]
 * - invoke 'known-hosts.add'    { host, port, keyType, base64 } → stored id
 * - invoke 'known-hosts.remove' { host, port, keyType? } → { removed }
 * - invoke 'known-hosts.import' (file picker) → { added, skipped, file? }
 *
 * The file itself lives next to the other YAET stores (env-aware config dir)
 * and is managed by KnownHostsService. Secrets are never involved — host keys
 * are public — so no encryption layer.
 */
const { dialog, ipcMain } = require('electron');
const { KnownHostsService } = require('../../services/knownHostsService');

let service = null;

function getService(log) {
  if (!service) service = new KnownHostsService(log);
  return service;
}

function sanitizeEntry(data = {}) {
  const host = String(data.host || '').trim();
  const port = Number(data.port) || 22;
  const keyType = String(data.keyType || '').trim();
  const base64 = String(data.base64 || '').trim();
  if (!host || !keyType || !base64) throw new Error('host, keyType and base64 are required');
  if (!/^[A-Za-z0-9+/=]+$/.test(base64)) throw new Error('invalid key encoding');
  return { host, port, keyType, base64 };
}

function initKnownHostsIpcHandler(log, mainWindow) {
  ipcMain.handle('known-hosts.list', () => getService(log).list());

  ipcMain.handle('known-hosts.add', (_event, data) => getService(log).add(sanitizeEntry(data)));

  ipcMain.handle('known-hosts.remove', (_event, data = {}) => {
    const host = String(data.host || '').trim();
    const port = Number(data.port) || 22;
    const keyType = data.keyType ? String(data.keyType) : undefined;
    return getService(log).remove({ host: host || undefined, port, keyType });
  });

  ipcMain.handle('known-hosts.import', async () => {
    const win = typeof mainWindow === 'function' ? mainWindow() : mainWindow;
    const picked = await dialog.showOpenDialog(win, {
      title: 'Import OpenSSH known_hosts',
      properties: ['openFile'],
      filters: [{ name: 'known_hosts', extensions: ['*'] }],
    });
    if (picked.canceled || !picked.filePaths || picked.filePaths.length === 0) {
      return { added: 0, skipped: 0, file: null };
    }
    const file = picked.filePaths[0];
    const result = getService(log).importOpenSSH(file);
    return { ...result, file };
  });

  log.info('[known-hosts] IPC handlers registered');
}

module.exports = { initKnownHostsIpcHandler };
