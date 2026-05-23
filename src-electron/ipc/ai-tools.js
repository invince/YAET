const { ipcMain } = require('electron');
const https = require('https');
const http = require('http');

function initAiToolsIpcHandler(log, toolExecutor) {
  ipcMain.handle('ai.send-with-tools', async (event, { apiUrl, token, model, messages }) => {
    const toolDefs = toolExecutor.getToolDefinitions();
    return _functionCallLoop(log, toolExecutor, apiUrl, token, model, messages, toolDefs, 0);
  });
}

async function _functionCallLoop(log, toolExecutor, apiUrl, token, model, messages, toolDefs, depth) {
  if (depth > 10) {
    messages.push({ role: 'assistant', content: 'Tool call limit reached. Please refine your request.' });
    return _callOpenAI(log, apiUrl, token, model, messages);
  }

  const response = await _callOpenAI(log, apiUrl, token, model, messages, toolDefs);
  const choice = response.choices?.[0];
  if (!choice) throw new Error('No response from AI');

  const message = choice.message;
  if (!message.tool_calls || message.tool_calls.length === 0) {
    return response;
  }

  messages.push({
    ...message,
    content: message.content || null,
  });

  for (const tc of message.tool_calls) {
    try {
      const args = JSON.parse(tc.function.arguments);
      log.info(`AI tool call: ${tc.function.name}(${JSON.stringify(args)})`);
      const result = await toolExecutor.execute(tc.function.name, args);
      messages.push({
        role: 'tool',
        tool_call_id: tc.id,
        content: JSON.stringify(result),
      });
    } catch (err) {
      log.error(`AI tool error ${tc.function.name}: ${err.message}`);
      messages.push({
        role: 'tool',
        tool_call_id: tc.id,
        content: JSON.stringify({ error: err.message }),
      });
    }
  }

  return _functionCallLoop(log, toolExecutor, apiUrl, token, model, messages, toolDefs, depth + 1);
}

function _callOpenAI(log, apiUrl, token, model, messages, tools) {
  const url = `${apiUrl}/chat/completions`;
  const urlObj = new URL(url);

  const body = { model, messages };
  if (tools) {
    body.tools = tools;
    body.tool_choice = 'auto';
  }

  const bodyStr = JSON.stringify(body);

  const options = {
    hostname: urlObj.hostname,
    port: urlObj.port || (urlObj.protocol === 'https:' ? 443 : 80),
    path: urlObj.pathname,
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(bodyStr),
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
      log.error('AI tools request error: ' + err.message);
      reject(err);
    });
    req.write(bodyStr);
    req.end();
  });
}

module.exports = { initAiToolsIpcHandler };
