const EventEmitter = require('events');

class TerminalRuntimeApi extends EventEmitter {
  async connect(options) {
    throw new Error('not implemented');
  }

  async write(data) {
    throw new Error('not implemented');
  }

  async resize(cols, rows) {
    throw new Error('not implemented');
  }

  async close() {
    throw new Error('not implemented');
  }

  async exec(command) {
    throw new Error('not implemented');
  }

  // P1-4: liveness probe. Connectors maintaining a live channel override
  // with real state; the default falls back to the conventional _connected
  // flag, then true (stateless connectors are always usable).
  isAlive() {
    if (this._connected !== undefined) return !!this._connected;
    return true;
  }
}

module.exports = { TerminalRuntimeApi };
