const https = require('https');
const http = require('http');

function _httpRequest(log, url, method, headers, body) {
  const urlObj = new URL(url);
  const options = {
    hostname: urlObj.hostname,
    port: urlObj.port || (urlObj.protocol === 'https:' ? 443 : 80),
    path: urlObj.pathname + urlObj.search,
    method,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
  };

  const lib = urlObj.protocol === 'https:' ? https : http;

  return new Promise((resolve, reject) => {
    const req = lib.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(parsed);
          } else {
            const errMsg = parsed.error?.message || parsed.error || `HTTP ${res.statusCode}`;
            reject(new Error(`AI API error (${res.statusCode}): ${errMsg}`));
          }
        } catch (e) {
          reject(new Error(`Failed to parse AI response: ${e.message}. Raw: ${data.substring(0, 200)}`));
        }
      });
    });
    req.on('error', (err) => {
      log.error('AI request error: ' + err.message);
      reject(err);
    });
    if (body) {
      req.write(typeof body === 'string' ? body : JSON.stringify(body));
    }
    req.end();
  });
}

async function fetchModels(log, apiUrl, token) {
  const base = apiUrl.replace(/\/+$/, '');
  const modelsUrl = base + (base.endsWith('/models') ? '' : '/models');
  const result = await _httpRequest(log, modelsUrl, 'GET', { 'Authorization': `Bearer ${token}` });
  return (result.data || []).map(m => m.id || m);
}

async function callChat(log, apiUrl, token, model, messages) {
  const url = `${apiUrl.replace(/\/+$/, '')}/chat/completions`;
  const body = JSON.stringify({ model, messages });
  const headers = {
    'Authorization': `Bearer ${token}`,
    'Content-Length': Buffer.byteLength(body),
  };
  return _httpRequest(log, url, 'POST', headers, body);
}

async function callChatWithTools(log, apiUrl, token, model, messages, tools) {
  const url = `${apiUrl.replace(/\/+$/, '')}/chat/completions`;
  const body = JSON.stringify({ model, messages, tools, tool_choice: 'auto' });
  const headers = {
    'Authorization': `Bearer ${token}`,
    'Content-Length': Buffer.byteLength(body),
  };
  return _httpRequest(log, url, 'POST', headers, body);
}

module.exports = { fetchModels, callChat, callChatWithTools };
