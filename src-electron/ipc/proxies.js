const { ipcMain } = require('electron');
const fs = require('fs');
const path = require('path');
const { APP_CONFIG_PATH, PROXIES_JSON } = require('../common');

function initProxiesIpcHandler(log, onProxiesChanged) {
    const proxiesPath = path.join(APP_CONFIG_PATH, PROXIES_JSON);
    log.info('Initializing proxies IPC handler', proxiesPath);

    ipcMain.on('proxies.save', (event, arg) => {
        try {
            fs.writeFileSync(proxiesPath, JSON.stringify(arg.data));
            if (onProxiesChanged) {
                onProxiesChanged(arg.data);
            }
        } catch (e) {
            log.error('Error saving proxies', e);
        }
    });

    ipcMain.on('proxies.reload', (event, arg) => {
        log.info('Reloading proxies requested');
        loadProxies(event, log, proxiesPath);
    });
}

function loadProxies(event, log, proxiesPath) {
    try {
        if (fs.existsSync(proxiesPath)) {
            const data = fs.readFileSync(proxiesPath, 'utf8');
            log.info('Proxies loaded from file', data.length);
            event.sender.send('proxies.loaded', JSON.parse(data));
        } else {
            log.info('Proxies file not found, sending empty list');
            event.sender.send('proxies.loaded', { proxies: [] });
        }
    } catch (e) {
        log.error('Error loading proxies', e);
        event.sender.send('proxies.loaded', { proxies: [] });
    }
}

module.exports = { initProxiesIpcHandler };
