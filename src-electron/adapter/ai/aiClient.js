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

// Streaming chat (OpenAI-compatible `stream: true` SSE).
// onEvent receives `{ chunk }` deltas as text arrives, then a terminal
// `{ done: true, full }`. Resolves with `{ content: full }`.
// Servers that ignore `stream: true` and return buffered JSON are handled:
// the body is parsed once and emitted as a single `{ full }` + `{ done }`.
async function callChatStream(log, apiUrl, token, model, messages, opts = {}) {
  // Some OpenAI-compatible servers 400 on the stream_options field — retry
  // once without it (usage reporting is lost, streaming still works).
  try {
    return await callChatStreamAttempt(log, apiUrl, token, model, messages, opts, true);
  } catch (e) {
    if (!opts.signal?.aborted && /stream_options/i.test((e && e.message) || '')) {
      try { log.warn('stream_options rejected, retrying without usage reporting'); } catch (_) {}
      return await callChatStreamAttempt(log, apiUrl, token, model, messages, opts, false);
    }
    throw e;
  }
}

async function callChatStreamAttempt(log, apiUrl, token, model, messages, opts = {}, withStreamOpts = true) {
  const { timeoutMs = 120000, signal, onEvent } = opts;
  // Streams stay open a long time — the timeout is an IDLE guard (no bytes
  // for this long), plus an absolute ceiling against runaway streams.
  const idleMs = Math.max(15000, Number(timeoutMs) || 120000);
  const maxTotalMs = Math.max(idleMs * 4, 300000);
  const url = `${apiUrl.replace(/\/+$/, '')}/chat/completions`;
  const body = JSON.stringify({
    model,
    messages,
    stream: true,
    ...(withStreamOpts ? { stream_options: { include_usage: true } } : {}),
  });
  const headers = {
    'Authorization': `Bearer ${token}`,
    'Content-Length': Buffer.byteLength(body),
    'Accept': 'text/event-stream',
  };
  const urlObj = new URL(url);
  const lib = urlObj.protocol === 'https:' ? https : http;

  return new Promise((resolve, reject) => {
    let settled = false;
    let full = '';
    let sseBuf = '';
    let rawBody = '';
    let sseMode = false;
    let modeDecided = false;
    let idleTimer = null;
    let totalTimer = null;
    const emit = (e) => { try { onEvent && onEvent(e); } catch (_) {} };
    const cleanup = () => {
      if (idleTimer) clearTimeout(idleTimer);
      if (totalTimer) clearTimeout(totalTimer);
      if (signal && onAbort) signal.removeEventListener('abort', onAbort);
    };
    const ok = (v) => { if (!settled) { settled = true; cleanup(); resolve(v); } };
    const fail = (e) => { if (!settled) { settled = true; cleanup(); reject(e); } };
    if (signal?.aborted) { fail(new Error('Cancelled by user')); return; }

    const pokeIdle = () => {
      if (idleTimer) clearTimeout(idleTimer);
      idleTimer = setTimeout(() => {
        fail(new Error(`AI stream stalled (no data for ${Math.round(idleMs / 1000)}s)`));
        try { req.destroy(); } catch (_) {}
      }, idleMs);
    };

    const handleSseText = (text) => {
      sseBuf += text;
      const parts = sseBuf.split('\n');
      sseBuf = parts.pop();
      for (const line of parts) {
        const t = line.trim();
        if (!t || t.startsWith(':')) continue;
        if (!t.startsWith('data:')) continue;
        const payload = t.slice(5).trim();
        if (payload === '[DONE]') continue;
        let j = null;
        try { j = JSON.parse(payload); } catch (_) { continue; }
        if (j && j.error) {
          const msg = j.error.message || j.error.code || JSON.stringify(j.error);
          fail(new Error(`AI API error: ${msg}`));
          try { req.destroy(); } catch (_) {}
          return;
        }
        // Final chunk on usage-reporting streams carries no choices.
        if (j && j.usage) {
          emit({ usage: {
            prompt_tokens: j.usage.prompt_tokens || 0,
            completion_tokens: j.usage.completion_tokens || 0,
            total_tokens: j.usage.total_tokens || ((j.usage.prompt_tokens || 0) + (j.usage.completion_tokens || 0)),
          } });
        }
        const delta = j?.choices?.[0]?.delta?.content;
        if (typeof delta === 'string' && delta) {
          full += delta;
          emit({ chunk: delta });
        }
      }
    };

    const req = lib.request({
      hostname: urlObj.hostname,
      port: urlObj.port || (urlObj.protocol === 'https:' ? 443 : 80),
      path: urlObj.pathname + urlObj.search,
      method: 'POST',
      headers,
    }, (res) => {
      pokeIdle();
      if (res.statusCode < 200 || res.statusCode >= 300) {
        let errBody = '';
        res.on('data', (c) => { errBody += c; });
        res.on('end', () => {
          let msg = `HTTP ${res.statusCode}`;
          try {
            const parsed = JSON.parse(errBody);
            msg = parsed.error?.message || parsed.error || msg;
          } catch (_) { if (errBody.trim()) msg = errBody.trim().slice(0, 300); }
          fail(new Error(`AI API error (${res.statusCode}): ${msg}`));
        });
        return;
      }
      const ct = String(res.headers['content-type'] || '');
      if (/text\/event-stream/.test(ct)) { sseMode = true; modeDecided = true; }
      res.on('data', (c) => {
        pokeIdle();
        const text = c.toString('utf8');
        if (!modeDecided) {
          // No (or unhelpful) content-type — sniff the first bytes.
          const head = (rawBody + text).trimStart();
          if (/^(data:|:)/.test(head)) { sseMode = true; }
          modeDecided = true;
        }
        if (sseMode) handleSseText(text);
        else rawBody += text;
      });
      res.on('end', () => {
        if (settled) return;
        if (!sseMode) {
          try {
            const parsed = JSON.parse(rawBody);
            full = parsed.choices?.[0]?.message?.content || '';
            if (full) emit({ full });
            if (parsed.usage) emit({ usage: {
              prompt_tokens: parsed.usage.prompt_tokens || 0,
              completion_tokens: parsed.usage.completion_tokens || 0,
              total_tokens: parsed.usage.total_tokens || 0,
            } });
          } catch (e) {
            fail(new Error(`Failed to parse AI response: ${e.message}. Raw: ${String(rawBody).substring(0, 200)}`));
            return;
          }
        } else if (sseBuf.trim()) {
          // Trailing line without a final newline.
          handleSseText('\n');
        }
        emit({ done: true, full });
        ok({ content: full });
      });
    });
    req.on('error', (err) => {
      log.error('AI stream error: ' + err.message);
      fail(err);
    });
    const onAbort = () => {
      try { req.destroy(); } catch (_) {}
      fail(new Error('Cancelled by user'));
    };
    if (signal) signal.addEventListener('abort', onAbort, { once: true });
    totalTimer = setTimeout(() => {
      fail(new Error(`AI stream exceeded maximum duration (${Math.round(maxTotalMs / 1000)}s)`));
      try { req.destroy(); } catch (_) {}
    }, maxTotalMs);
    pokeIdle();
    req.write(body);
    req.end();
  });
}

module.exports = { fetchModels, callChat, callChatWithTools, callChatStream };
