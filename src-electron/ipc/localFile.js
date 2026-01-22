const { ipcMain, app, shell } = require('electron');
const fs = require('fs');
const path = require('path');

const LOCAL_FILE_SAVE_TEMP = 'local-file.save-temp';
const LOCAL_FILE_OPEN = 'local-file.open';
const LOCAL_FILE_WATCH = 'local-file.watch';
const LOCAL_FILE_UNWATCH = 'local-file.unwatch';
const LOCAL_FILE_CHANGED = 'local-file.changed';
const LOCAL_FILE_READ = 'local-file.read';

let watchers = new Map();

function initLocalFileHandler(log, mainWindow) {

    ipcMain.handle(LOCAL_FILE_SAVE_TEMP, async (event, { filename, buffer, folder }) => {
        try {
            const tempDir = app.getPath('temp');
            const targetDir = path.join(tempDir, 'yaet', folder || ''); // 'yaet' subfolder to keep things clean
            
            if (!fs.existsSync(targetDir)) {
                fs.mkdirSync(targetDir, { recursive: true });
            }

            const filePath = path.join(targetDir, filename);
            // buffer comes as Uint8Array/Buffer from renderer
            fs.writeFileSync(filePath, Buffer.from(buffer));
            
            return { success: true, path: filePath };
        } catch (error) {
            log.error('Error saving temp file:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle(LOCAL_FILE_OPEN, async (event, filePath) => {
        try {
            const result = await shell.openPath(filePath);
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
            if (fs.existsSync(filePath)) {
                const content = fs.readFileSync(filePath, 'utf-8');
                return { success: true, content };
            }
            return { success: false, error: 'File not found' };
        } catch (error) {
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle(LOCAL_FILE_WATCH, (event, filePath) => {
        try {
            if (watchers.has(filePath)) {
                // Already watching
                return { success: true }; 
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
