class FileExplorerRuntimeApi {
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

module.exports = { FileExplorerRuntimeApi };
