const { FileExplorerRuntimeApi } = require('../../interfaces/fileExplorerRuntimeApi');

class FtpFileExplorer extends FileExplorerRuntimeApi {
  constructor(log, config) {
    super();
    this.log = log;
    this.config = config;
  }

  async listFiles(path) {
    throw new Error('not implemented');
  }

  async readFile(path) {
    throw new Error('not implemented');
  }

  async writeFile(path, content) {
    throw new Error('not implemented');
  }
}

module.exports = { FtpFileExplorer };
