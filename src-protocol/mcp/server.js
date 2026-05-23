const readline = require('readline');

const LATEST_PROTOCOL_VERSION = '2024-11-05';

class MCPServer {
  constructor(serverInfo = { name: 'yaet', version: '5.0.0' }) {
    this.serverInfo = serverInfo;
    this.tools = new Map();
    this.resources = new Map();
    this._requestId = 0;
    this._initialized = false;
    this.transport = null;
  }

  nextId() {
    return ++this._requestId;
  }

  registerTool(name, description, inputSchema, handler) {
    this.tools.set(name, { name, description, inputSchema, handler });
  }

  registerResource(uri, name, description, handler) {
    this.resources.set(uri, { uri, name, description, handler });
  }

  async handleRequest(request) {
    const { id, method, params } = request;

    switch (method) {
      case 'initialize':
        return this._handleInitialize(params, id);

      case 'ping':
        return this._createResult(id, {});

      case 'tools/list':
        return this._handleToolsList(id);

      case 'tools/call':
        return this._handleToolCall(params, id);

      case 'resources/list':
        return this._handleResourcesList(id);

      case 'resources/read':
        return this._handleResourceRead(params, id);

      default:
        return this._createError(id, -32601, `Method not found: ${method}`);
    }
  }

  async _handleInitialize(params, id) {
    this._initialized = true;
    const clientVersion = params?.protocolVersion;
    const version = clientVersion || LATEST_PROTOCOL_VERSION;

    return this._createResult(id, {
      protocolVersion: version,
      capabilities: {
        tools: {},
        resources: this.resources.size > 0 ? {} : undefined,
      },
      serverInfo: this.serverInfo,
    });
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
    const toolName = params?.name;
    const args = params?.arguments || {};

    if (!toolName) {
      return this._createError(id, -32602, 'Missing tool name');
    }

    const tool = this.tools.get(toolName);
    if (!tool) {
      return this._createError(id, -32602, `Unknown tool: ${toolName}`);
    }

    try {
      const result = await tool.handler(args);
      return this._createResult(id, {
        content: [
          {
            type: 'text',
            text: typeof result === 'string' ? result : JSON.stringify(result, null, 2),
          },
        ],
      });
    } catch (error) {
      return this._createResult(id, {
        content: [
          {
            type: 'text',
            text: `Error: ${error.message}`,
          },
        ],
        isError: true,
      });
    }
  }

  _handleResourcesList(id) {
    const resources = Array.from(this.resources.values()).map(r => ({
      uri: r.uri,
      name: r.name,
      description: r.description,
    }));
    return this._createResult(id, { resources });
  }

  async _handleResourceRead(params, id) {
    const uri = params?.uri;
    if (!uri || !this.resources.has(uri)) {
      return this._createError(id, -32602, `Unknown resource: ${uri}`);
    }
    try {
      const contents = await this.resources.get(uri).handler(params);
      return this._createResult(id, { contents });
    } catch (error) {
      return this._createResult(id, {
        contents: [],
        isError: true,
        error: error.message,
      });
    }
  }

  _createResult(id, result) {
    return { jsonrpc: '2.0', id, result };
  }

  _createError(id, code, message) {
    return { jsonrpc: '2.0', id, error: { code, message } };
  }

  // ---- Transport: stdio ----
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

module.exports = { MCPServer };
