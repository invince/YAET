const path = require('path');
const SMB2 = require('v9u-smb2');
const { FileExplorerRuntimeApi } = require('../../../src-electron/runtime/interfaces/fileExplorerRuntimeApi');

class SambaFileExplorer extends FileExplorerRuntimeApi {
  constructor(log, config) {
    super();
    this.log = log;
    this.config = config;
  }

  _fixPath(p) {
    if (!p) return '';
    let s = p;
    if (s.endsWith('/')) s = s.slice(0, -1);
    if (s.startsWith('/')) s = s.slice(1);
    return s;
  }

  async _withSamba(callback) {
    const config = { ...this.config };
    if (!config.domain) config.domain = 'WORKGROUP';
    const smbClient = new SMB2(config);
    try {
      return await callback(smbClient);
    } finally {
      smbClient.disconnect();
    }
  }

  async _list(smbClient, pathParam, names) {
    let files = await smbClient.readdir(pathParam, { stats: true });
    if (names) {
      files = files.filter(f => names.includes(f.name));
    }
    if (!files) return [];
    return files.map(f => ({
      name: f.name,
      type: f.isDirectory() ? 'folder' : 'file',
      isFile: !f.isDirectory(),
      size: f.size,
      dateModified: f.mtime,
    }));
  }

  async _copyDirectory(smbClient, sourceDir, targetDir) {
    await smbClient.mkdir(targetDir, true);
    const items = await smbClient.readdir(sourceDir, { stats: true });
    for (const item of items) {
      const src = path.join(sourceDir, item.name);
      const dst = path.join(targetDir, item.name);
      if (item.isDirectory()) {
        await this._copyDirectory(smbClient, src, dst);
      } else {
        const content = await smbClient.readFile(src);
        await smbClient.writeFile(dst, content);
      }
    }
  }

  async _avoidDuplicateName(smbClient, targetFilePathOg) {
    let fp = targetFilePathOg;
    const dir = path.dirname(fp);
    const ext = path.extname(fp);
    const base = path.basename(fp, ext);
    let idx = 1;
    while (await smbClient.exists(fp)) {
      fp = dir === '.' ? `${base}_${idx}${ext}` : path.join(dir, `${base}_${idx}${ext}`);
      idx++;
    }
    return fp;
  }

  async listFiles(pathParam) {
    return this._withSamba(async (smbClient) => {
      return { files: await this._list(smbClient, pathParam || '') };
    });
  }

  async readFile(filePath) {
    return this._withSamba(async (smbClient) => {
      return await smbClient.readFile(filePath);
    });
  }

  async writeFile(remotePath, data, options) {
    return this._withSamba(async (smbClient) => {
      if (options && options.overwrite === false) {
        remotePath = await this._avoidDuplicateName(smbClient, remotePath);
      }
      await smbClient.writeFile(remotePath, data);
      return { path: remotePath };
    });
  }

  async deleteFiles(pathParam, items) {
    pathParam = this._fixPath(pathParam);
    return this._withSamba(async (smbClient) => {
      for (const item of items) {
        const abs = path.join(pathParam, item.name);
        if (item.type === 'folder') {
          await smbClient.rmdir(abs);
        } else {
          await smbClient.unlink(abs);
        }
      }
      return { files: await this._list(smbClient, pathParam) };
    });
  }

  async renameFile(pathParam, name, newName) {
    pathParam = this._fixPath(pathParam);
    return this._withSamba(async (smbClient) => {
      await smbClient.rename(path.join(pathParam, name), path.join(pathParam, newName));
      return { files: await this._list(smbClient, pathParam) };
    });
  }

  async copyFiles(pathParam, names, targetPath) {
    pathParam = this._fixPath(pathParam);
    targetPath = this._fixPath(targetPath);
    return this._withSamba(async (smbClient) => {
      for (const name of names) {
        const srcPath = path.join(pathParam, name);
        const dstPath = await this._avoidDuplicateName(smbClient, path.join(targetPath, name));
        let srcIsDir = false;
        try {
          const stat = await smbClient.readdir(srcPath, { stats: true });
          srcIsDir = true;
        } catch { /* inferred not dir */ }
        if (srcIsDir) {
          await this._copyDirectory(smbClient, srcPath, dstPath);
        } else {
          const content = await smbClient.readFile(srcPath);
          await smbClient.writeFile(dstPath, content);
        }
      }
      return { files: await this._list(smbClient, targetPath) };
    });
  }

  async moveFiles(pathParam, names, targetPath) {
    pathParam = this._fixPath(pathParam);
    targetPath = this._fixPath(targetPath);
    return this._withSamba(async (smbClient) => {
      for (const name of names) {
        const srcPath = path.join(pathParam, name);
        const dstPath = await this._avoidDuplicateName(smbClient, path.join(targetPath, name));
        try {
          await smbClient.rename(srcPath, dstPath);
        } catch {
          const content = await smbClient.readFile(srcPath);
          await smbClient.writeFile(dstPath, content);
          await smbClient.unlink(srcPath);
        }
      }
      return { files: await this._list(smbClient, targetPath) };
    });
  }

  async createFolder(pathParam, name) {
    pathParam = this._fixPath(pathParam);
    return this._withSamba(async (smbClient) => {
      const newPath = path.join(pathParam, name);
      const exists = await smbClient.exists(newPath);
      if (exists) {
        return { error: { code: 416, message: 'folder already exists' } };
      }
      await smbClient.mkdir(newPath, true);
      return { files: await this._list(smbClient, newPath) };
    });
  }

  async search(pathParam, searchString, options) {
    pathParam = this._fixPath(pathParam);
    return this._withSamba(async (smbClient) => {
      const files = await smbClient.readdir(pathParam, { stats: true });
      const flags = (options && options.caseSensitive) ? '' : 'i';
      const escaped = require('lodash').escapeRegExp(searchString).replace(/\\\*/g, '.*');
      const regex = new RegExp(escaped, flags);
      const filtered = files.filter(f => {
        const hidden = f.name.startsWith('.');
        return (options && options.showHiddenItems || !hidden) && regex.test(f.name);
      }).map(f => ({
        name: f.name,
        type: f.isDirectory() ? 'folder' : 'file',
        size: f.size,
        modifyTime: f.mtime,
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

module.exports = { SambaFileExplorer };
