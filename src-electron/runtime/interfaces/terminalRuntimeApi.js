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
}

module.exports = { TerminalRuntimeApi };
