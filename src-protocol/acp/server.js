const readline = require('readline');
const crypto = require('crypto');

class ACPServer {
  constructor(serverInfo = { name: 'yaet', version: '5.0.0' }) {
    this.serverInfo = serverInfo;
    this.tools = new Map();
    this.sessions = new Map();
    this._requestId = 0;
  }

  nextId() {
    return ++this._requestId;
  }

  registerTool(name, description, inputSchema, handler) {
    this.tools.set(name, { name, description, inputSchema, handler });
  }

  async handleRequest(request) {
    const { id, method, params } = request;

    switch (method) {
      case 'initialize':
        return this._handleInitialize(params, id);

      case 'session/new':
        return this._handleSessionNew(params, id);

      case 'session/prompt':
        return this._handleSessionPrompt(request, id);

      case 'session/close':
        return this._handleSessionClose(params, id);

      case 'tools/list':
        return this._handleToolsList(id);

      case 'tools/call':
        return this._handleToolCall(params, id);

      default:
        return this._createError(id, -32601, `Method not found: ${method}`);
    }
  }

  _handleInitialize(params, id) {
    return this._createResult(id, {
      protocolVersion: 1,
      serverCapabilities: {
        tools: this.tools.size > 0,
        sessions: true,
      },
      serverInfo: this.serverInfo,
    });
  }

  _handleSessionNew(params, id) {
    const sessionId = `acp-session-${Date.now()}-${crypto.randomBytes(8).toString('hex')}`;
    this.sessions.set(sessionId, {
      id: sessionId,
      cwd: params?.cwd || process.cwd(),
      model: params?.model || null,
      mcpServers: params?.mcpServers || [],
      createdAt: new Date().toISOString(),
    });
    return this._createResult(id, { sessionId });
  }

  async _handleSessionPrompt(request, id) {
    const { sessionId, prompt, model } = request.params || {};

    if (!sessionId || !this.sessions.has(sessionId)) {
      return this._createError(id, -32602, 'Invalid or missing sessionId');
    }

    const session = this.sessions.get(sessionId);
    const promptText = Array.isArray(prompt)
      ? prompt.map(p => p.text || '').join('\n')
      : (typeof prompt === 'string' ? prompt : JSON.stringify(prompt));

    let accumulatedResult = '';

    for (const [toolName, tool] of this.tools) {
      try {
        const args = { prompt: promptText, sessionId, model: model || session.model };
        const result = await tool.handler(args);
        const resultStr = typeof result === 'string' ? result : JSON.stringify(result, null, 2);
        accumulatedResult += `\n[Tool: ${toolName}]\n${resultStr}\n`;
      } catch (err) {
        accumulatedResult += `\n[Tool: ${toolName} Error: ${err.message}]\n`;
      }
    }

    const finalText = accumulatedResult || 'No tools available to process this prompt.';

    if (request.id != null) {
      return this._createResult(id, {
        content: { type: 'text', text: finalText },
      });
    }
  }

  _handleSessionClose(params, id) {
    const { sessionId } = params || {};
    if (sessionId) {
      this.sessions.delete(sessionId);
    }
    return this._createResult(id, { closed: true });
  }

  _handleToolsList(id) {
    const tools = Array.from(this.tools.values()).map(t => ({
      name: t.name,
      description: t.description,
      inputSchema: t.inputSchema,
    }));
    return this._createResult(id, { tools });
  }

  async _handleToolCall(params, id) {
    const { name, arguments: args } = params || {};
    if (!name || !this.tools.has(name)) {
      return this._createError(id, -32602, `Unknown tool: ${name}`);
    }

    try {
      const result = await this.tools.get(name).handler(args || {});
      return this._createResult(id, {
        content: { type: 'text', text: typeof result === 'string' ? result : JSON.stringify(result, null, 2) },
      });
    } catch (error) {
      return this._createResult(id, {
        content: { type: 'text', text: `Error: ${error.message}` },
        isError: true,
      });
    }
  }

  _createResult(id, result) {
    return { jsonrpc: '2.0', id, result };
  }

  _createError(id, code, message) {
    return { jsonrpc: '2.0', id, error: { code, message } };
  }

  async runStdio() {
    const rl = readline.createInterface({ input: process.stdin });

    for await (const line of rl) {
      try {
        const request = JSON.parse(line);

        if (request.method === 'notifications/initialized') {
          continue;
        }

        const response = await this.handleRequest(request);
        if (response && request.id != null) {
          process.stdout.write(JSON.stringify(response) + '\n');
        }
      } catch (err) {
        if (request?.id != null) {
          const errorResp = this._createError(request.id, -32700, `Parse error: ${err.message}`);
          process.stdout.write(JSON.stringify(errorResp) + '\n');
        }
      }
    }
  }
}

module.exports = { ACPServer };
