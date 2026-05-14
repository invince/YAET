const { ipcMain } = require('electron');
const https = require('https');
const http = require('http');

function initAiIpcHandler(log) {
  ipcMain.handle('ai.fetch-models', async (event, { apiUrl, token }) => {
    const urlObj = new URL(apiUrl);
    const modelsPath = urlObj.pathname.endsWith('/') ? urlObj.pathname + 'models' : urlObj.pathname + '/models';
    const options = {
      hostname: urlObj.hostname,
      port: urlObj.port || (urlObj.protocol === 'https:' ? 443 : 80),
      path: modelsPath,
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      rejectUnauthorized: false,
    };

    const lib = urlObj.protocol === 'https:' ? https : http;

    return new Promise((resolve, reject) => {
      const req = lib.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          try {
            const parsed = JSON.parse(data);
            const models = (parsed.data || []).map((m) => m.id || m);
            resolve(models);
          } catch (e) {
            reject(new Error('Failed to parse models response: ' + e.message));
          }
        });
      });
      req.on('error', (err) => {
        log.error('AI fetch-models error: ' + err.message);
        reject(err);
      });
      req.end();
    });
  });
}

module.exports = { initAiIpcHandler };
