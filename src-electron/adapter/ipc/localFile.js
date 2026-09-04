const { ipcMain, app, shell } = require('electron');
const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');

const LOCAL_FILE_SAVE_TEMP = 'local-file.save-temp';
const LOCAL_FILE_OPEN = 'local-file.open';
const LOCAL_FILE_WATCH = 'local-file.watch';
const LOCAL_FILE_UNWATCH = 'local-file.unwatch';
const LOCAL_FILE_CHANGED = 'local-file.changed';
const LOCAL_FILE_READ = 'local-file.read';

let watchers = new Map();

// P0-S6: bounds for renderer-driven file access. The renderer is trusted-ish
// (own code) but XSS-reachable via markdown/AI output, so every path here is
// validated server-side instead of trusting the caller.
const SAVE_TEMP_FOLDER_RE = /^[A-Za-z0-9_-]{1,32}$/;
const MAX_WATCHERS = 20;
const MAX_READ_BYTES = 2 * 1024 * 1024;
// Executed by the OS association on open — never open these programmatically.
const EXEC_EXTS = new Set(['.exe', '.bat', '.cmd', '.com', '.msi', '.lnk', '.ps1', '.vbs', '.jar', '.app']);

function initLocalFileHandler(log, mainWindow) {

    ipcMain.handle(LOCAL_FILE_SAVE_TEMP, async (event, { filename, buffer, folder }) => {
        try {
            // P0-S6: the old basename-only check was bypassable via folder=../../..
            const safeFolder = SAVE_TEMP_FOLDER_RE.test(folder || '') ? folder : 'misc';
            const tempDir = app.getPath('temp');
            const targetDir = path.resolve(tempDir, 'yaet', safeFolder);
            if (targetDir !== path.resolve(tempDir, 'yaet') && !targetDir.startsWith(path.resolve(tempDir, 'yaet') + path.sep)) {
                throw new Error('Invalid folder');
            }

            await fsp.mkdir(targetDir, { recursive: true });

            const baseName = path.basename(filename || '');
            if (!baseName) throw new Error('Invalid filename');
            const filePath = path.resolve(targetDir, baseName);
            if (filePath !== targetDir && !filePath.startsWith(targetDir + path.sep)) {
                throw new Error('Invalid filename: path traversal detected');
            }
            await fsp.writeFile(filePath, Buffer.from(buffer));

            return { success: true, path: filePath };
        } catch (error) {
            log.error('Error saving temp file:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle(LOCAL_FILE_OPEN, async (event, filePath) => {
        try {
            // P0-S6: shell.openPath executes per OS association — refuse
            // executables and require existence first.
            const resolved = path.resolve(String(filePath || ''));
            if (!fs.existsSync(resolved)) {
                return { success: false, error: 'File not found' };
            }
            if (EXEC_EXTS.has(path.extname(resolved).toLowerCase())) {
                log.error('Refused to open executable file:', resolved);
                return { success: false, error: 'Refused to open executable file type' };
            }
            const result = await shell.openPath(resolved);
            if (result) {
               // result is error string if failed
               log.error('Error opening file:', result);
               return { success: false, error: result };
            }
            return { success: true };
        } catch (error) {
            log.error('Error opening file:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle(LOCAL_FILE_READ, async (event, filePath) => {
        try {
            // P0-S6: cap size so a compromised renderer can't exfil GBs.
            const stat = await fsp.stat(String(filePath || ''));
            if (!stat.isFile()) {
                return { success: false, error: 'Not a file' };
            }
            if (stat.size > MAX_READ_BYTES) {
                return { success: false, error: `File too large (${stat.size} bytes > ${MAX_READ_BYTES})` };
            }
            const content = await fsp.readFile(filePath, 'utf-8');
            return { success: true, content };
        } catch (error) {
            if (error.code === 'ENOENT') {
                return { success: false, error: 'File not found' };
            }
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle(LOCAL_FILE_WATCH, (event, filePath) => {
        try {
            if (watchers.has(filePath)) {
                // Already watching
                return { success: true }; 
            }

            // P0-S6: bound fd usage — evict oldest when full.
            if (watchers.size >= MAX_WATCHERS) {
                const oldest = watchers.keys().next().value;
                try { watchers.get(oldest)?.close(); } catch (_) {}
                watchers.delete(oldest);
                log.warn(`Watcher limit reached, evicted oldest: ${oldest}`);
            }

            // Using fs.watch for simplicity. 
            // Note: editors might use 'rename' (atomic save) vs 'change'.
            // fs.watch is tricky across platforms but standard 'change' usually works for this simplified case.
            const watcher = fs.watch(filePath, (eventType, filename) => {
                if (eventType === 'change' || eventType === 'rename') {
                     // Check if file still exists (rename might mean deleted temporarily during safe save)
                     if (fs.existsSync(filePath)) {
                        mainWindow.webContents.send(LOCAL_FILE_CHANGED, filePath);
                     }
                }
            });
            
            watchers.set(filePath, watcher);
            return { success: true };

        } catch (error) {
            log.error('Error watching file:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle(LOCAL_FILE_UNWATCH, (event, filePath) => {
        try {
            const watcher = watchers.get(filePath);
            if (watcher) {
                watcher.close();
                watchers.delete(filePath);
            }
            return { success: true };
        } catch (error) {
            log.error('Error unwatching file:', error);
            return { success: false, error: error.message };
        }
    });
}

module.exports = { initLocalFileHandler };
