const levels = { debug: 0, info: 1, warn: 2, error: 3 };

class Logger {
  constructor(name = 'yaet', level = 'debug') {
    this.name = name;
    this.level = levels[level] || 0;
  }

  _log(level, msg) {
    if (levels[level] < this.level) return;
    const ts = new Date().toISOString();
    const args = [ts, `[${level.toUpperCase()}]`, `[${this.name}]`, msg];
    if (level === 'error') {
      console.error(...args);
    } else {
      console.log(...args);
    }
  }

  debug(msg) { this._log('debug', msg); }
  info(msg) { this._log('info', msg); }
  warn(msg) { this._log('warn', msg); }
  error(msg) { this._log('error', msg); }
}

module.exports = { Logger };
