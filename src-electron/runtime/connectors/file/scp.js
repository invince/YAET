const SftpClient = require('ssh2-sftp-client');
const path = require('path');
const _ = require('lodash');
const { FileExplorerRuntimeApi } = require('../../interfaces/fileExplorerRuntimeApi');

class ScpFileExplorer extends FileExplorerRuntimeApi {
  constructor(log, sshConfig) {
    super();
    this.log = log;
    this.sshConfig = sshConfig;
  }

  async _withSftp(callback) {
    const config = { ...this.sshConfig };
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

  async _list(sftp, pathParam, names) {
    let files = await sftp.list(pathParam);
    if (names) {
      files = files.filter(f => names.includes(f.name));
    }
    return files.map(f => ({
      name: f.name,
      type: f.type === 'd' ? 'folder' : 'file',
      isFile: f.type !== 'd',
      size: f.size,
      dateModified: f.modifyTime,
    }));
  }

  async _avoidDuplicateName(sftp, targetFilePathOg) {
    let targetFilePath = targetFilePathOg;
    const dir = path.dirname(targetFilePathOg);
    const ext = path.extname(targetFilePathOg);
    const base = path.basename(targetFilePathOg, ext);
    let idx = 1;
    while (await sftp.exists(targetFilePath)) {
      targetFilePath = `${dir}/${base}_${idx}${ext}`;
      idx++;
    }
    return targetFilePath;
  }

  async _copyDirectory(sftp, sourcePath, targetPath) {
    await sftp.mkdir(targetPath, true);
    const items = await sftp.list(sourcePath);
    for (const item of items) {
      const src = `${sourcePath}/${item.name}`;
      const dst = `${targetPath}/${item.name}`;
      if (item.type === 'd') {
        await this._copyDirectory(sftp, src, dst);
      } else {
        await sftp.rcopy(src, dst);
      }
    }
  }

  async listFiles(pathParam) {
    return this._withSftp(async (sftp) => {
      return { files: await this._list(sftp, pathParam || '/') };
    });
  }

  async readFile(filePath) {
    return this._withSftp(async (sftp) => {
      return sftp.get(filePath);
    });
  }

  async writeFile(remotePath, data, options) {
    return this._withSftp(async (sftp) => {
      if (options && options.overwrite === false) {
        remotePath = await this._avoidDuplicateName(sftp, remotePath);
      }
      await sftp.put(data, remotePath);
      return { path: remotePath };
    });
  }

  async deleteFiles(pathParam, items) {
    return this._withSftp(async (sftp) => {
      for (const item of items) {
        const abs = `${pathParam}${item.name}`;
        if (item.type === 'folder') {
          await sftp.rmdir(abs, true);
        } else {
          await sftp.delete(abs);
        }
      }
      return { files: await this._list(sftp, pathParam) };
    });
  }

  async renameFile(pathParam, name, newName) {
    return this._withSftp(async (sftp) => {
      await sftp.rename(`${pathParam}${name}`, `${pathParam}${newName}`);
      return { files: await this._list(sftp, pathParam) };
    });
  }

  async copyFiles(pathParam, names, targetPath) {
    return this._withSftp(async (sftp) => {
      for (const name of names) {
        const srcPath = `${pathParam}${name}`;
        const dstPath = await this._avoidDuplicateName(sftp, `${targetPath}${name}`);
        const stats = await sftp.stat(srcPath);
        if (stats.isDirectory) {
          await this._copyDirectory(sftp, srcPath, dstPath);
        } else {
          await sftp.rcopy(srcPath, dstPath);
        }
      }
      return { files: await this._list(sftp, targetPath, names) };
    });
  }

  async moveFiles(pathParam, names, targetPath) {
    return this._withSftp(async (sftp) => {
      if (targetPath !== pathParam) {
        for (const name of names) {
          const srcPath = `${pathParam}${name}`;
          const dstPath = await this._avoidDuplicateName(sftp, `${targetPath}${name}`);
          const stats = await sftp.stat(srcPath);
          if (stats.isDirectory) {
            await this._copyDirectory(sftp, srcPath, dstPath);
            await sftp.rmdir(srcPath, true);
          } else {
            await sftp.rcopy(srcPath, dstPath);
            await sftp.delete(srcPath);
          }
        }
      }
      return { files: await this._list(sftp, targetPath, names) };
    });
  }

  async createFolder(pathParam, name) {
    return this._withSftp(async (sftp) => {
      const newPath = `${pathParam}${name}`;
      if (await sftp.exists(newPath)) {
        return { error: { code: 416, message: 'folder already exists' } };
      }
      await sftp.mkdir(newPath, true);
      return { files: await this._list(sftp, newPath) };
    });
  }

  async search(pathParam, searchString, options) {
    return this._withSftp(async (sftp) => {
      const files = await sftp.list(pathParam);
      const regexFlags = (options && options.caseSensitive) ? '' : 'i';
      const escaped = _.escapeRegExp(searchString).replace(/\\\*/g, '.*');
      const regex = new RegExp(escaped, regexFlags);
      const filtered = files.filter(f => {
        const hidden = f.name.startsWith('.');
        return (options && options.showHiddenItems || !hidden) && regex.test(f.name);
      }).map(f => ({
        name: f.name,
        type: f.type === '-' ? 'file' : 'folder',
        size: f.size,
        modifyTime: f.modifyTime,
        accessTime: f.accessTime,
      }));
      return { files: filtered };
    });
  }

  async uploadFile(remotePath, data, options) {
    return this.writeFile(remotePath, data, options);
  }

  async downloadFile(remotePath) {
    return this.readFile(remotePath);
  }
}

module.exports = { ScpFileExplorer };
