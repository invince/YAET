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

  async deleteFiles(pathParam, items) {
    throw new Error('not implemented');
  }

  async renameFile(pathParam, name, newName) {
    throw new Error('not implemented');
  }

  async copyFiles(pathParam, names, targetPath) {
    throw new Error('not implemented');
  }

  async moveFiles(pathParam, names, targetPath) {
    throw new Error('not implemented');
  }

  async createFolder(pathParam, name) {
    throw new Error('not implemented');
  }

  async search(pathParam, searchString, options) {
    throw new Error('not implemented');
  }

  async uploadFile(remotePath, data, options) {
    throw new Error('not implemented');
  }

  async downloadFile(remotePath) {
    throw new Error('not implemented');
  }
}

module.exports = { FileExplorerRuntimeApi };
