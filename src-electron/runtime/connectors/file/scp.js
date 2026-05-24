const { SCPService } = require('../../../services/scpService');
const { FileExplorerRuntimeApi } = require('../../interfaces/fileExplorerRuntimeApi');

class ScpFileExplorer extends FileExplorerRuntimeApi {
  constructor(log, sshConfig) {
    super();
    this.log = log;
    this.sshConfig = sshConfig;
    this.scpService = new SCPService(log);
  }

  async listFiles(path) {
    return this.scpService.listFiles(this.sshConfig, path || '/');
  }

  async readFile(path) {
    const buffer = await this.scpService.readFile(this.sshConfig, path);
    return { content: buffer.toString('utf-8') };
  }

  async writeFile(path, content) {
    return this.scpService.writeFile(this.sshConfig, path, Buffer.from(content, 'utf-8'), { overwrite: true });
  }
}

module.exports = { ScpFileExplorer };
