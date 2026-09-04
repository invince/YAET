const https = require('https');
const http = require('http');

function _httpRequest(log, url, method, headers, body, opts = {}) {
  // P1-1: timeout + abort. timeoutMs only guards the LLM HTTP call —
  // tool execution (ssh/scp) has its own timeoutSeconds.
  const { timeoutMs = 120000, signal } = opts;
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
    let settled = false;
    const cleanup = () => {
      if (signal && onAbort) signal.removeEventListener('abort', onAbort);
    };
    const ok = (v) => { if (!settled) { settled = true; cleanup(); resolve(v); } };
    const fail = (e) => { if (!settled) { settled = true; cleanup(); reject(e); } };
    if (signal?.aborted) { fail(new Error('Cancelled by user')); return; }

    const req = lib.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (res.statusCode >= 200 && res.statusCode < 300) {
            ok(parsed);
          } else {
            const errMsg = parsed.error?.message || parsed.error || `HTTP ${res.statusCode}`;
            fail(new Error(`AI API error (${res.statusCode}): ${errMsg}`));
          }
        } catch (e) {
          fail(new Error(`Failed to parse AI response: ${e.message}. Raw: ${data.substring(0, 200)}`));
        }
      });
    });
    req.on('error', (err) => {
      log.error('AI request error: ' + err.message);
      fail(err);
    });
    const onAbort = () => {
      try { req.destroy(); } catch (_) {}
      fail(new Error('Cancelled by user'));
    };
    if (signal) signal.addEventListener('abort', onAbort, { once: true });
    req.setTimeout(timeoutMs, () => {
      fail(new Error(`AI request timed out after ${timeoutMs}ms`));
      try { req.destroy(); } catch (_) {}
    });
    if (body) {
      req.write(typeof body === 'string' ? body : JSON.stringify(body));
    }
    req.end();
  });
}

async function fetchModels(log, apiUrl, token, opts = {}) {
  const base = apiUrl.replace(/\/+$/, '');
  const modelsUrl = base + (base.endsWith('/models') ? '' : '/models');
  const result = await _httpRequest(log, modelsUrl, 'GET', { 'Authorization': `Bearer ${token}` }, null, opts);
  return (result.data || []).map(m => m.id || m);
}

async function callChat(log, apiUrl, token, model, messages, opts = {}) {
  const url = `${apiUrl.replace(/\/+$/, '')}/chat/completions`;
  const body = JSON.stringify({ model, messages });
  const headers = {
    'Authorization': `Bearer ${token}`,
    'Content-Length': Buffer.byteLength(body),
  };
  return _httpRequest(log, url, 'POST', headers, body, opts);
}

async function callChatWithTools(log, apiUrl, token, model, messages, tools, opts = {}) {
  const url = `${apiUrl.replace(/\/+$/, '')}/chat/completions`;
  const body = JSON.stringify({ model, messages, tools, tool_choice: 'auto' });
  const headers = {
    'Authorization': `Bearer ${token}`,
    'Content-Length': Buffer.byteLength(body),
  };
  return _httpRequest(log, url, 'POST', headers, body, opts);
}

module.exports = { fetchModels, callChat, callChatWithTools };
