const { RemoteDesktopRuntimeApi } = require('../../interfaces/remoteDesktopRuntimeApi');

class RdpDesktop extends RemoteDesktopRuntimeApi {
  constructor(log, config) {
    super();
    this.log = log;
    this.config = config;
  }

  async connect(config) {
    throw new Error('not implemented');
  }

  async disconnect() {
    throw new Error('not implemented');
  }
}

module.exports = { RdpDesktop };
