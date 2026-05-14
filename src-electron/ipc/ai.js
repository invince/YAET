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

function initAiChatIpcHandler(log) {
  ipcMain.handle('ai.send-chat', async (event, { apiUrl, token, model, messages }) => {
    const url = `${apiUrl}/chat/completions`;
    const urlObj = new URL(url);

    const body = JSON.stringify({ model, messages });

    const options = {
      hostname: urlObj.hostname,
      port: urlObj.port || (urlObj.protocol === 'https:' ? 443 : 80),
      path: urlObj.pathname,
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
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
            resolve(parsed);
          } catch (e) {
            reject(new Error('Failed to parse AI response: ' + e.message));
          }
        });
      });
      req.on('error', (err) => {
        log.error('AI send-chat error: ' + err.message);
        reject(err);
      });
      req.write(body);
      req.end();
    });
  });
}

module.exports = { initAiIpcHandler, initAiChatIpcHandler };
