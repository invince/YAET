const path = require('path');
const SMB2 = require('v9u-smb2');

class SambaService {
  constructor(log) {
    this.log = log;
    this.connections = new Map();
  }

  registerConnection(id, config) {
    this.connections.set(id, config);
  }

  fixPath(pathParam) {
    let p = pathParam || '';
    if (p.endsWith('/')) p = p.slice(0, -1);
    if (p.startsWith('/')) p = p.slice(1);
    return p;
  }

  async withSambaClient(configIdOrConfig, callback) {
    let config;
    if (typeof configIdOrConfig === 'string') {
      config = this.connections.get(configIdOrConfig);
      if (!config) throw new Error('Error: connection config not found');
    } else {
      config = configIdOrConfig;
    }

    if (!config.domain) config.domain = 'WORKGROUP';

    const smbClient = new SMB2(config);
    try {
      return await callback(smbClient);
    } finally {
      smbClient.disconnect();
    }
  }

  async list(smbClient, pathParam, names) {
    let files = await smbClient.readdir(pathParam, { stats: true });
    if (names) {
      files = files.filter((file) => names.includes(file.name));
    }
    if (!files) return [];
    return files.map((file) => ({
      name: file.name,
      type: file.isDirectory() ? 'folder' : 'file',
      isFile: !file.isDirectory(),
      size: file.size,
      dateModified: file.mtime,
    }));
  }

  async copyDirectory(smbClient, sourceDir, targetDir) {
    await smbClient.mkdir(targetDir, true);
    const items = await smbClient.readdir(sourceDir, { stats: true });
    for (const item of items) {
      const sourcePath = path.join(sourceDir, item.name);
      const targetPath = path.join(targetDir, item.name);
      if (item.isDirectory()) {
        await this.copyDirectory(smbClient, sourcePath, targetPath);
      } else {
        await this.copyPasteFile(smbClient, sourcePath, targetPath);
      }
    }
  }

  async copyPasteFile(smbClient, sourcePath, destPath) {
    const fileContent = await smbClient.readFile(sourcePath);
    await smbClient.writeFile(destPath, fileContent);
  }

  async avoidDuplicateName(smbClient, targetFilePathOg) {
    let targetFilePath = targetFilePathOg;
    const parseFilePath = (filePath) => {
      const fileName = path.basename(filePath, path.extname(filePath));
      const fileExt = path.extname(filePath);
      const dir = path.dirname(filePath);
      return { dir, fileName, fileExt };
    };

    const { dir, fileName, fileExt } = parseFilePath(targetFilePathOg);
    let index = 1;

    while (await smbClient.exists(targetFilePath)) {
      if (dir === '.') {
        targetFilePath = `${fileName}_${index}${fileExt}`;
      } else {
        targetFilePath = path.join(dir, `${fileName}_${index}${fileExt}`);
      }
      index++;
    }
    return targetFilePath;
  }

  async listFiles(connectionIdOrConfig, pathParam) {
    return this.withSambaClient(connectionIdOrConfig, async (smbClient) => {
      return { files: await this.list(smbClient, pathParam) };
    });
  }

  async deleteFiles(connectionIdOrConfig, pathParam, items) {
    pathParam = this.fixPath(pathParam);
    return this.withSambaClient(connectionIdOrConfig, async (smbClient) => {
      for (const oneData of items) {
        const fileAbsPath = path.join(pathParam, oneData.name);
        if (oneData.type === 'folder') {
          await smbClient.rmdir(fileAbsPath);
        } else {
          await smbClient.unlink(fileAbsPath);
        }
      }
      return { files: await this.list(smbClient, pathParam) };
    });
  }

  async renameFile(connectionIdOrConfig, pathParam, name, newName) {
    pathParam = this.fixPath(pathParam);
    return this.withSambaClient(connectionIdOrConfig, async (smbClient) => {
      await smbClient.rename(path.join(pathParam, name), path.join(pathParam, newName));
      return { files: await this.list(smbClient, pathParam) };
    });
  }

  async readFile(connectionIdOrConfig, filePath) {
    return this.withSambaClient(connectionIdOrConfig, async (smbClient) => {
      return await smbClient.readFile(filePath);
    });
  }

  async writeFile(connectionIdOrConfig, remotePath, data, options = {}) {
    return this.withSambaClient(connectionIdOrConfig, async (smbClient) => {
      let targetPath;
      if (options.overwrite) {
        targetPath = remotePath;
      } else {
        targetPath = await this.avoidDuplicateName(smbClient, remotePath);
      }
      await smbClient.writeFile(targetPath, data);
      return { path: targetPath };
    });
  }
}

module.exports = { SambaService };
