const { TerminalRuntimeApi } = require('../../interfaces/terminalRuntimeApi');

class WinRMTerminal extends TerminalRuntimeApi {
  constructor(log, config) {
    super();
    this.log = log;
    this.config = config;
  }

  async exec(command) {
    throw new Error('not implemented');
  }
}

module.exports = { WinRMTerminal };
