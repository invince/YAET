const ftp = require('basic-ftp');
const path = require('path');
const _ = require('lodash');
const { Writable, Readable } = require('stream');

class FTPService {
  constructor(log) {
    this.log = log;
    this.connections = new Map();
  }

  registerConnection(id, config) {
    this.connections.set(id, config);
  }

  async withFtpClient(configIdOrConfig, callback) {
    let config;
    if (typeof configIdOrConfig === 'string') {
      config = this.connections.get(configIdOrConfig);
      if (!config) throw new Error('Error connection config not found');
    } else {
      config = configIdOrConfig;
    }

    const client = new ftp.Client();
    client.ftp.verbose = true;

    try {
      await client.access(config);
      return await callback(client);
    } finally {
      client.close();
    }
  }

  async avoidDuplicateName(client, targetFilePathOg) {
    let targetFilePath = targetFilePathOg;
    const parseFilePath = (filePath) => {
      const fileName = path.basename(filePath, path.extname(filePath));
      const fileExt = path.extname(filePath);
      const dir = path.dirname(filePath);
      return { dir, fileName, fileExt };
    };

    const { dir, fileName, fileExt } = parseFilePath(targetFilePathOg);
    let index = 1;

    while (await this.exists(client, targetFilePath)) {
      if (dir === '.') {
        targetFilePath = `${fileName}_${index}${fileExt}`;
      } else {
        targetFilePath = `${dir}/${fileName}_${index}${fileExt}`;
      }
      index++;
    }
    return targetFilePath;
  }

  async list(client, pathParam) {
    const files = await client.list(pathParam);
    return files.map(file => ({
      name: file.name,
      type: file.isDirectory ? 'folder' : 'file',
      isFile: !file.isDirectory,
      size: file.size,
      dateModified: file.modifiedAt,
    }));
  }

  async exists(client, remoteFilePath) {
    const directoryPath = remoteFilePath.substring(0, remoteFilePath.lastIndexOf('/') + 1);
    const fileName = remoteFilePath.substring(remoteFilePath.lastIndexOf('/') + 1);
    try {
      const files = await client.list(directoryPath);
      return files.some(file => file.name === fileName);
    } catch (error) {
      return false;
    }
  }

  async listFiles(connectionIdOrConfig, pathParam) {
    return this.withFtpClient(connectionIdOrConfig, async (client) => {
      return { files: await this.list(client, pathParam) };
    });
  }

  async search(connectionIdOrConfig, pathParam, searchString, options = {}) {
    return this.withFtpClient(connectionIdOrConfig, async (client) => {
      const files = await client.list(pathParam);
      const regexFlags = options.caseSensitive ? '' : 'i';
      let safeSearch = _.escapeRegExp(searchString);
      safeSearch = safeSearch.replace(/\\\*/g, '.*');
      const searchRegex = new RegExp(safeSearch, regexFlags);
      const filtered = files.filter(item => {
        const isHidden = item.name.startsWith('.');
        return (options.showHiddenItems || !isHidden) && searchRegex.test(item.name);
      }).map(item => ({
        name: item.name,
        type: item.isDirectory ? 'folder' : 'file',
        size: item.size,
        modifyTime: item.modifiedAt,
      }));
      return { files: filtered };
    });
  }

  async deleteFiles(connectionIdOrConfig, pathParam, items) {
    return this.withFtpClient(connectionIdOrConfig, async (client) => {
      for (const oneData of items) {
        const fileAbsPath = `${pathParam}${oneData.name}`;
        if (oneData.type === 'folder') {
          await client.removeDir(fileAbsPath);
        } else {
          await client.remove(fileAbsPath);
        }
      }
      return { files: await this.list(client, pathParam) };
    });
  }

  async renameFile(connectionIdOrConfig, pathParam, name, newName) {
    return this.withFtpClient(connectionIdOrConfig, async (client) => {
      await client.rename(`${pathParam}${name}`, `${pathParam}${newName}`);
      return { files: await this.list(client, pathParam) };
    });
  }

  async copyFiles(connectionIdOrConfig, pathParam, names, targetPath) {
    return this.withFtpClient(connectionIdOrConfig, async (client) => {
      for (const name of names) {
        const sourcePath = `${pathParam}${name}`;
        const targetPathWithName = await this.avoidDuplicateName(client, `${targetPath}${name}`);
        const chunks = [];
        const writableStream = new Writable({
          write(chunk, encoding, callback) { chunks.push(chunk); callback(); },
        });
        await client.downloadTo(writableStream, sourcePath);
        const buffer = Buffer.concat(chunks);
        const bufferStream = new Readable();
        bufferStream.push(buffer);
        bufferStream.push(null);
        await client.uploadFrom(bufferStream, targetPathWithName);
      }
      return { files: await this.list(client, targetPath) };
    });
  }

  async moveFiles(connectionIdOrConfig, pathParam, names, targetPath) {
    return this.withFtpClient(connectionIdOrConfig, async (client) => {
      for (const name of names) {
        const sourcePath = `${pathParam}${name}`;
        const targetPathWithName = await this.avoidDuplicateName(client, `${targetPath}${name}`);
        try {
          await client.rename(sourcePath, targetPathWithName);
        } catch (error) {
          this.log.info('Rename failed, using copy+delete:', error.message);
          const chunks = [];
          const writableStream = new Writable({
            write(chunk, encoding, callback) { chunks.push(chunk); callback(); },
          });
          await client.downloadTo(writableStream, sourcePath);
          const buffer = Buffer.concat(chunks);
          const bufferStream = new Readable();
          bufferStream.push(buffer);
          bufferStream.push(null);
          await client.uploadFrom(bufferStream, targetPathWithName);
          await client.remove(sourcePath);
        }
      }
      return { files: await this.list(client, targetPath) };
    });
  }

  async createFolder(connectionIdOrConfig, pathParam, name) {
    return this.withFtpClient(connectionIdOrConfig, async (client) => {
      const newFolderPath = `${pathParam}${name}`;
      if (await this.exists(client, newFolderPath)) {
        return { error: { code: 416, message: 'folder already exists' } };
      }
      await client.ensureDir(newFolderPath);
      return { files: await this.list(client, newFolderPath) };
    });
  }

  async readFile(connectionIdOrConfig, filePath) {
    return this.withFtpClient(connectionIdOrConfig, async (client) => {
      const chunks = [];
      const writableStream = new Writable({
        write(chunk, encoding, callback) { chunks.push(chunk); callback(); },
      });
      await client.downloadTo(writableStream, filePath);
      return Buffer.concat(chunks);
    });
  }

  async writeFile(connectionIdOrConfig, remotePath, data, options = {}) {
    return this.withFtpClient(connectionIdOrConfig, async (client) => {
      let targetPath;
      if (options.overwrite) {
        targetPath = remotePath;
      } else {
        targetPath = await this.avoidDuplicateName(client, remotePath);
      }
      const bufferStream = new Readable();
      bufferStream.push(data);
      bufferStream.push(null);
      await client.uploadFrom(bufferStream, targetPath);
      return { path: targetPath };
    });
  }
}

module.exports = { FTPService };
