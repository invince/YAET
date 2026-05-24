const SftpClient = require('ssh2-sftp-client');
const path = require('path');
const _ = require('lodash');
const { ProxyService } = require('./proxyService');

class SCPService {
  constructor(log) {
    this.log = log;
    this.proxyService = new ProxyService(log);
    this.connections = new Map();
  }

  registerConnection(id, config) {
    this.connections.set(id, config);
  }

  async withSftpClient(configIdOrConfig, callback) {
    let configData;
    if (typeof configIdOrConfig === 'string') {
      configData = this.connections.get(configIdOrConfig);
      if (!configData) throw new Error('Error connection config not found');
    } else {
      configData = { config: configIdOrConfig };
    }

    const config = configData.config || configData;
    const proxyId = configData.proxyId;

    if (proxyId) {
      const proxyRepo = configData.getProxies || (() => null);
      const secretRepo = configData.getSecrets || (() => null);
      try {
        this.log.info(`SCP connection: Using proxy ${proxyId}`);
        const proxies = proxyRepo();
        if (proxies && proxies.proxies) {
          const proxy = proxies.proxies.find(p => p.id === proxyId);
          if (proxy) {
            const sock = await this.proxyService.createProxyConnection(
              proxy, config.host, config.port || 22, secretRepo
            );
            config.sock = sock;
          }
        }
      } catch (error) {
        this.log.error(`SCP proxy connection failed:`, error);
        throw error;
      }
    }

    if (!config.debug) {
      config.debug = (msg) => {
        if (msg.includes('Error') || msg.includes('Warning')) {
          this.log.debug(`SFTP Debug: ${msg}`);
        }
      };
    }

    const sftp = new SftpClient();
    try {
      await sftp.connect(config);
      return await callback(sftp);
    } finally {
      await sftp.end();
    }
  }

  async avoidDuplicateName(sftp, targetFilePathOg) {
    let targetFilePath = targetFilePathOg;
    const parseFilePath = (filePath) => {
      const fileName = path.basename(filePath, path.extname(filePath));
      const fileExt = path.extname(filePath);
      const dir = path.dirname(filePath);
      return { dir, fileName, fileExt };
    };

    const { dir, fileName, fileExt } = parseFilePath(targetFilePathOg);
    let index = 1;

    while (await sftp.exists(targetFilePath)) {
      targetFilePath = `${dir}/${fileName}_${index}${fileExt}`;
      index++;
    }
    return targetFilePath;
  }

  async list(sftp, pathParam, names) {
    let files = await sftp.list(pathParam);
    if (names) {
      files = files.filter((file) => names.includes(file.name));
    }
    return files.map(file => ({
      name: file.name,
      type: file.type === 'd' ? 'folder' : 'file',
      isFile: file.type !== 'd',
      size: file.size,
      dateModified: file.modifyTime,
    }));
  }

  async copyDirectory(sftp, sourcePath, targetPath) {
    await sftp.mkdir(targetPath, true);
    const items = await sftp.list(sourcePath);
    for (const item of items) {
      const sourceItemPath = `${sourcePath}/${item.name}`;
      const targetItemPath = `${targetPath}/${item.name}`;
      if (item.type === 'd') {
        await this.copyDirectory(sftp, sourceItemPath, targetItemPath);
      } else {
        await sftp.rcopy(sourceItemPath, targetItemPath);
      }
    }
  }

  async listFiles(connectionIdOrConfig, pathParam) {
    return this.withSftpClient(connectionIdOrConfig, async (sftp) => {
      return { files: await this.list(sftp, pathParam) };
    });
  }

  async search(connectionIdOrConfig, pathParam, searchString, options = {}) {
    return this.withSftpClient(connectionIdOrConfig, async (sftp) => {
      const files = await sftp.list(pathParam);
      const regexFlags = options.caseSensitive ? '' : 'i';
      const escapedSearchString = _.escapeRegExp(searchString).replace(/\\\*/g, '.*');
      const searchRegex = new RegExp(escapedSearchString, regexFlags);
      const filtered = files.filter(item => {
        const isHidden = item.name.startsWith('.');
        return (options.showHiddenItems || !isHidden) && searchRegex.test(item.name);
      }).map(item => ({
        name: item.name,
        type: item.type === '-' ? 'file' : 'folder',
        size: item.size,
        modifyTime: item.modifyTime,
        accessTime: item.accessTime,
      }));
      return { files: filtered };
    });
  }

  async deleteFiles(connectionIdOrConfig, pathParam, items) {
    return this.withSftpClient(connectionIdOrConfig, async (sftp) => {
      for (const oneData of items) {
        const fileAbsPath = `${pathParam}${oneData.name}`;
        if (oneData.type === 'folder') {
          await sftp.rmdir(fileAbsPath, true);
        } else {
          await sftp.delete(fileAbsPath);
        }
      }
      return { files: await this.list(sftp, pathParam) };
    });
  }

  async renameFile(connectionIdOrConfig, pathParam, name, newName) {
    return this.withSftpClient(connectionIdOrConfig, async (sftp) => {
      await sftp.rename(`${pathParam}${name}`, `${pathParam}${newName}`);
      return { files: await this.list(sftp, pathParam) };
    });
  }

  async copyFiles(connectionIdOrConfig, pathParam, names, targetPath) {
    return this.withSftpClient(connectionIdOrConfig, async (sftp) => {
      for (const name of names) {
        const sourceFilePath = `${pathParam}${name}`;
        const targetFilePath = await this.avoidDuplicateName(sftp, `${targetPath}${name}`);
        const stats = await sftp.stat(sourceFilePath);
        if (stats.isDirectory) {
          await this.copyDirectory(sftp, sourceFilePath, targetFilePath);
        } else {
          await sftp.rcopy(sourceFilePath, targetFilePath);
        }
      }
      return { files: await this.list(sftp, targetPath, names) };
    });
  }

  async moveFiles(connectionIdOrConfig, pathParam, names, targetPath) {
    return this.withSftpClient(connectionIdOrConfig, async (sftp) => {
      if (targetPath !== pathParam) {
        for (const name of names) {
          const sourceFilePath = `${pathParam}${name}`;
          const targetFilePath = await this.avoidDuplicateName(sftp, `${targetPath}${name}`);
          const stats = await sftp.stat(sourceFilePath);
          if (stats.isDirectory) {
            await this.copyDirectory(sftp, sourceFilePath, targetFilePath);
            await sftp.rmdir(sourceFilePath, true);
          } else {
            await sftp.rcopy(sourceFilePath, targetFilePath);
            await sftp.delete(sourceFilePath);
          }
        }
      }
      return { files: await this.list(sftp, targetPath, names) };
    });
  }

  async createFolder(connectionIdOrConfig, pathParam, name) {
    return this.withSftpClient(connectionIdOrConfig, async (sftp) => {
      const newFolderPath = `${pathParam}${name}`;
      if (await sftp.exists(newFolderPath)) {
        return { error: { code: 416, message: 'folder already exists' } };
      }
      await sftp.mkdir(newFolderPath, true);
      return { files: await this.list(sftp, newFolderPath) };
    });
  }

  async readFile(connectionIdOrConfig, filePath) {
    return this.withSftpClient(connectionIdOrConfig, async (sftp) => {
      return await sftp.get(filePath);
    });
  }

  async writeFile(connectionIdOrConfig, remotePath, data, options = {}) {
    return this.withSftpClient(connectionIdOrConfig, async (sftp) => {
      let targetPath;
      if (options.overwrite) {
        targetPath = remotePath;
      } else {
        targetPath = await this.avoidDuplicateName(sftp, remotePath);
      }
      await sftp.put(data, targetPath);
      return { path: targetPath };
    });
  }
}

module.exports = { SCPService };
