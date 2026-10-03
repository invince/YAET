const levels = { debug: 0, info: 1, warn: 2, error: 3 };

class Logger {
  constructor(name = 'yaet', level = 'debug') {
    this.name = name;
    this.level = levels[level] || 0;
  }

  _log(level, msg) {
    if (levels[level] < this.level) return;
    const ts = new Date().toISOString();
    // Always stderr: MCP/ACP stdio transport owns stdout for JSON-RPC only.
    console.error(ts, `[${level.toUpperCase()}]`, `[${this.name}]`, msg);
  }

  debug(msg) { this._log('debug', msg); }
  info(msg) { this._log('info', msg); }
  warn(msg) { this._log('warn', msg); }
  error(msg) { this._log('error', msg); }
}

module.exports = { Logger };
