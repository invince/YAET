const { ipcMain, dialog } = require('electron');
const fs = require('fs');
const path = require('path');
const JSZip = require('jszip');
const { getAppConfigPath } = require('../../services/envConfig');

// Sync item name (as shown in the Setting Sync page) -> local JSON file.
// Files are zipped as stored on disk (encrypted blobs stay encrypted).
const ITEM_FILES = {
  setting: 'settings.json',
  profile: 'profiles.json',
  secret: 'secrets.json',
  proxy: 'proxies.json',
};

function stamp(date) {
  const p = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}${p(date.getMonth() + 1)}${p(date.getDate())}-${p(date.getHours())}${p(date.getMinutes())}${p(date.getSeconds())}`;
}

function initSettingBackupIpcHandler(log, mainWindow) {
  ipcMain.handle('setting.backup', async (event, data) => {
    const items = (data && data.items) || [];
    const files = [];
    for (const item of items) {
      const f = ITEM_FILES[String(item).toLowerCase()];
      if (f && !files.includes(f)) files.push(f);
    }
    if (files.length === 0) {
      return { succeed: false, ok: [], ko: ['no items selected'] };
    }

    try {
      const zip = new JSZip();
      const ok = [];
      for (const f of files) {
        const abs = path.join(getAppConfigPath(), f);
        if (!fs.existsSync(abs)) {
          log.warn(`Backup: skipping missing file ${f}`);
          continue;
        }
        zip.file(f, fs.readFileSync(abs));
        ok.push('+' + f);
      }
      if (ok.length === 0) {
        return { succeed: false, ok: [], ko: ['none of the selected files exist locally'] };
      }

      const buf = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
      const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
        title: 'Save settings backup',
        defaultPath: `yaet-backup-${stamp(new Date())}.zip`,
        filters: [{ name: 'ZIP archive', extensions: ['zip'] }],
      });
      if (canceled || !filePath) {
        return { succeed: false, ok: [], ko: ['cancelled'] };
      }
      fs.writeFileSync(filePath, buf);
      ok.push('saved: ' + filePath);
      return { succeed: true, ok, ko: [] };
    } catch (err) {
      const msg = (err && err.message) || String(err);
      log.error('Backup failed:', msg);
      return { succeed: false, ok: [], ko: [msg] };
    }
  });
}

module.exports = { initSettingBackupIpcHandler };
