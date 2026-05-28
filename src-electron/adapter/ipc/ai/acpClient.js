const { ipcMain } = require('electron');
const { spawn } = require('child_process');
const os = require('os');
const readline = require('readline');

let acpRequestId = 1;
const acpProcesses = new Map();

function nextId() {
  return acpRequestId++;
}

function sendJson(child, obj) {
  const line = JSON.stringify(obj) + '\n';
  child.stdin.write(line);
}

async function readJsonLine(rl) {
  return new Promise((resolve, reject) => {
    // Increase timeout to 5 minutes for LLM generation
    const to = setTimeout(() => reject(new Error('ACP read timeout')), 300000);

    const onLine = (line) => {
      clearTimeout(to);
      rl.removeListener('close', onClose);
      try {
        const parsed = JSON.parse(line);
        // log.debug('ACP RECV: ' + JSON.stringify(parsed));
        resolve(parsed);
      } catch (e) {
        reject(new Error('ACP invalid JSON: ' + line));
      }
    };

    const onClose = () => {
      clearTimeout(to);
      rl.removeListener('line', onLine);
      reject(new Error('ACP process closed before returning data'));
    };

    rl.once('line', onLine);
    rl.once('close', onClose);
  });
}

async function ensureSession(command, argList, log, model) {
  const key = command + '|' + argList.join(' ') + '|' + (model || '');

  const existing = acpProcesses.get(key);
  if (existing) {
    if (!existing.child.killed) {
      return existing;
    }
    acpProcesses.delete(key);
  }

  log.info('ACP starting: ' + command + (argList.length > 0 ? ' ' + argList.join(' ') : ''));
  const isWin = os.platform() === 'win32';
  const child = spawn(command, argList, {
    stdio: ['pipe', 'pipe', 'pipe'],
    windowsHide: true,
    shell: isWin,
  });

  const session = { child, sessionId: null };

  child.on('error', (err) => {
    log.error('ACP process error: ' + err.message);
  });

  child.on('close', (code) => {
    log.info('ACP process exited with code ' + code);
    if (acpProcesses.get(key)?.child === child) {
      acpProcesses.delete(key);
    }
  });

  const rl = readline.createInterface({ input: child.stdout });

  // Step 1: initialize
  const initId = nextId();
  sendJson(child, {
    jsonrpc: '2.0',
    id: initId,
    method: 'initialize',
    params: {
      protocolVersion: 1,
      clientCapabilities: {
        terminal: true
      },
      clientInfo: {
        name: "yaet",
        version: "1.0.0"
      }
    }
  });
  let msg;
  do {
    msg = await readJsonLine(rl);
  } while (msg.id !== initId);
  if (msg.error) throw new Error('ACP initialize error: ' + JSON.stringify(msg.error));

  // Step 2: session/new
  const sessId = nextId();
  sendJson(child, {
    jsonrpc: '2.0',
    id: sessId,
    method: 'session/new',
    params: {
      cwd: process.cwd(),
      mcpServers: [],
      model: model || undefined
    }
  });
  do {
    msg = await readJsonLine(rl);
  } while (msg.id !== sessId);
  if (msg.error) throw new Error('ACP session/new error: ' + JSON.stringify(msg.error));

  session.sessionId = msg.result.sessionId;
  session.rl = rl;
  acpProcesses.set(key, session);
  log.info('ACP session ready: ' + session.sessionId);
  return session;
}

function initAcpClientIpcHandler(log) {
  ipcMain.handle('acp.fetch-models', async (event, { command, args }) => {
    if (!command) {
      throw new Error('ACP command is not configured');
    }
    const isWin = os.platform() === 'win32';

    // Replace 'acp' with 'models' in the command string
    let finalCommand = command.replace(/\bacp\b/g, 'models');
    if (!finalCommand.includes('models')) {
        finalCommand += ' models';
    }

    log.info('ACP fetch-models starting: ' + finalCommand);

    return new Promise((resolve, reject) => {
      const child = spawn(finalCommand, [], {
        stdio: ['pipe', 'pipe', 'pipe'],
        windowsHide: true,
        shell: isWin,
      });

      let output = '';
      let errorOutput = '';
      child.stdout.on('data', (data) => {
        output += data.toString();
      });
      child.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });

      child.on('close', (code) => {
        if (code === 0) {
          const models = output.split('\n').map(s => s.trim()).filter(s => s.length > 0);
          log.info(`ACP fetch-models success, found ${models.length} models`);
          resolve(models);
        } else {
          log.error(`ACP models command failed with code ${code}. Stderr: ${errorOutput}`);
          reject(new Error(`ACP models command exited with code ${code}: ${errorOutput}`));
        }
      });

      child.on('error', (err) => {
        log.error(`ACP models command spawn error: ${err.message}`);
        reject(err);
      });
    });
  });

  ipcMain.handle('acp.send', async (event, { command, args, model, messages }) => {
    if (!command) {
      throw new Error('ACP command is not configured');
    }

    const argList = args ? args.split(' ').filter((s) => s.length > 0) : [];
    const session = await ensureSession(command, argList, log, model);
    const child = session.child;
    const rl = session.rl;

    const newPrompts = [];
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === 'user') {
        newPrompts.unshift(messages[i].content);
      } else {
        break;
      }
    }
    const promptText = newPrompts.join('\n\n');
    const prompt = [{ type: 'text', text: promptText }];

    const promptId = nextId();
    const promptParams = { sessionId: session.sessionId, prompt };
    if (model) {
      promptParams.model = model;
    }

    log.info(`ACP sending prompt (id=${promptId}, model=${model || 'default'}): ${promptText.substring(0, 50)}...`);
    sendJson(child, {
      jsonrpc: '2.0',
      id: promptId,
      method: 'session/prompt',
      params: promptParams,
    });

    let accumulatedText = '';
    while (true) {
      const msg = await readJsonLine(rl);
      // log.info(`ACP message: ${JSON.stringify(msg)}`);

      // notifications
      if (msg.method === 'session/update' && msg.params?.update) {
        const u = msg.params.update;
        log.info(`ACP Update: ${u.sessionUpdate}`);
        let chunk = '';
        // opencode seems to use sessionUpdate: 'agent_message_chunk'
        if (u.sessionUpdate === 'agent_message_chunk' && u.content) {
            if (u.content.type === 'text') {
                chunk = u.content.text;
            } else if (typeof u.content === 'string') {
                chunk = u.content;
            }
        }
        // or maybe 'agent_message'
        if (u.sessionUpdate === 'agent_message' && u.content) {
            if (Array.isArray(u.content)) {
                chunk = u.content.map(c => c.text || '').join('');
            } else if (u.content.type === 'text') {
                chunk = u.content.text;
            }
        }

        if (chunk) {
            if (u.sessionUpdate === 'agent_message') {
                event.sender.send('acp.chunk', { full: chunk });
                accumulatedText = chunk;
            } else {
                accumulatedText += chunk;
                event.sender.send('acp.chunk', { chunk });
            }
        }

        const isDone = u.sessionUpdate === 'agent_message' ||
                      u.sessionUpdate === 'usage_update' ||
                      (u.sessionUpdate === 'status' && (u.status === 'completed' || u.status === 'error')) ||
                      u.finishReason ||
                      u.stop_reason;

        if (isDone) {
            log.info(`ACP stream finished signal detected: ${u.sessionUpdate || ''} ${u.status || ''}`);
            event.sender.send('acp.chunk', { done: true });
            if (u.status === 'error') {
                throw new Error('ACP session update reported error');
            }
            if (accumulatedText || u.sessionUpdate === 'usage_update') {
                log.info(`ACP returning early with ${accumulatedText.length} chars`);
                return accumulatedText || '';
            }
        }
        continue;
      }

      // final response
      if (msg.id === promptId) {
        if (msg.error) {
            log.error(`ACP prompt error: ${JSON.stringify(msg.error)}`);
            throw new Error('ACP session/prompt error: ' + JSON.stringify(msg.error));
        }

        let finalResult = '';
        if (msg.result) {
            if (typeof msg.result.content === 'string') {
                finalResult = msg.result.content;
            } else if (Array.isArray(msg.result.content)) {
                finalResult = msg.result.content.map(c => c.text || '').join('');
            } else if (msg.result.content?.type === 'text') {
                finalResult = msg.result.content.text;
            }
        }

        const responseText = accumulatedText || finalResult || '';
        log.info(`ACP final response received (${responseText.length} chars)`);
        return responseText;
      }
    }
  });

  ipcMain.handle('acp.close', async (event, { command, args }) => {
    const key = command + '|' + args || '';
    const session = acpProcesses.get(key);
    if (session) {
      session.rl?.close();
      session.child?.kill();
      acpProcesses.delete(key);
    }
  });
}

module.exports = { initAcpClientIpcHandler };
