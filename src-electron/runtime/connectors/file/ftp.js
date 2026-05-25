const ftp = require('basic-ftp');
const path = require('path');
const _ = require('lodash');
const { Writable, Readable } = require('stream');
const { FileExplorerRuntimeApi } = require('../../interfaces/fileExplorerRuntimeApi');

class FtpFileExplorer extends FileExplorerRuntimeApi {
  constructor(log, config) {
    super();
    this.log = log;
    this.config = config;
  }

  async _withFtp(callback) {
    const client = new ftp.Client();
    client.ftp.verbose = true;
    try {
      await client.access(this.config);
      return await callback(client);
    } finally {
      client.close();
    }
  }

  async _list(client, pathParam) {
    const files = await client.list(pathParam);
    return files.map(f => ({
      name: f.name,
      type: f.isDirectory ? 'folder' : 'file',
      isFile: !f.isDirectory,
      size: f.size,
      dateModified: f.modifiedAt,
    }));
  }

  async _exists(client, remoteFilePath) {
    const dir = remoteFilePath.substring(0, remoteFilePath.lastIndexOf('/') + 1);
    const name = remoteFilePath.substring(remoteFilePath.lastIndexOf('/') + 1);
    try {
      const files = await client.list(dir);
      return files.some(f => f.name === name);
    } catch {
      return false;
    }
  }

  async _avoidDuplicateName(client, targetFilePathOg) {
    let fp = targetFilePathOg;
    const dir = path.dirname(fp);
    const ext = path.extname(fp);
    const base = path.basename(fp, ext);
    let idx = 1;
    while (await this._exists(client, fp)) {
      fp = dir === '.' ? `${base}_${idx}${ext}` : `${dir}/${base}_${idx}${ext}`;
      idx++;
    }
    return fp;
  }

  async listFiles(pathParam) {
    return this._withFtp(async (client) => {
      return { files: await this._list(client, pathParam || '/') };
    });
  }

  async readFile(filePath) {
    return this._withFtp(async (client) => {
      const chunks = [];
      const ws = new Writable({
        write(chunk, encoding, cb) { chunks.push(chunk); cb(); },
      });
      await client.downloadTo(ws, filePath);
      return Buffer.concat(chunks);
    });
  }

  async writeFile(remotePath, data, options) {
    return this._withFtp(async (client) => {
      if (options && options.overwrite === false) {
        remotePath = await this._avoidDuplicateName(client, remotePath);
      }
      const bs = new Readable();
      bs.push(data);
      bs.push(null);
      await client.uploadFrom(bs, remotePath);
      return { path: remotePath };
    });
  }

  async deleteFiles(pathParam, items) {
    return this._withFtp(async (client) => {
      for (const item of items) {
        const abs = `${pathParam}${item.name}`;
        if (item.type === 'folder') {
          await client.removeDir(abs);
        } else {
          await client.remove(abs);
        }
      }
      return { files: await this._list(client, pathParam) };
    });
  }

  async renameFile(pathParam, name, newName) {
    return this._withFtp(async (client) => {
      await client.rename(`${pathParam}${name}`, `${pathParam}${newName}`);
      return { files: await this._list(client, pathParam) };
    });
  }

  async copyFiles(pathParam, names, targetPath) {
    return this._withFtp(async (client) => {
      for (const name of names) {
        const srcPath = `${pathParam}${name}`;
        const dstPath = await this._avoidDuplicateName(client, `${targetPath}${name}`);
        const chunks = [];
        const ws = new Writable({
          write(chunk, encoding, cb) { chunks.push(chunk); cb(); },
        });
        await client.downloadTo(ws, srcPath);
        const buf = Buffer.concat(chunks);
        const bs = new Readable();
        bs.push(buf);
        bs.push(null);
        await client.uploadFrom(bs, dstPath);
      }
      return { files: await this._list(client, targetPath) };
    });
  }

  async moveFiles(pathParam, names, targetPath) {
    return this._withFtp(async (client) => {
      for (const name of names) {
        const srcPath = `${pathParam}${name}`;
        const dstPath = await this._avoidDuplicateName(client, `${targetPath}${name}`);
        try {
          await client.rename(srcPath, dstPath);
        } catch {
          const chunks = [];
          const ws = new Writable({
            write(chunk, encoding, cb) { chunks.push(chunk); cb(); },
          });
          await client.downloadTo(ws, srcPath);
          const buf = Buffer.concat(chunks);
          const bs = new Readable();
          bs.push(buf);
          bs.push(null);
          await client.uploadFrom(bs, dstPath);
          await client.remove(srcPath);
        }
      }
      return { files: await this._list(client, targetPath) };
    });
  }

  async createFolder(pathParam, name) {
    return this._withFtp(async (client) => {
      const newPath = `${pathParam}${name}`;
      if (await this._exists(client, newPath)) {
        return { error: { code: 416, message: 'folder already exists' } };
      }
      await client.ensureDir(newPath);
      return { files: await this._list(client, newPath) };
    });
  }

  async search(pathParam, searchString, options) {
    return this._withFtp(async (client) => {
      const files = await client.list(pathParam);
      const flags = (options && options.caseSensitive) ? '' : 'i';
      const escaped = _.escapeRegExp(searchString).replace(/\\\*/g, '.*');
      const regex = new RegExp(escaped, flags);
      const filtered = files.filter(f => {
        const hidden = f.name.startsWith('.');
        return (options && options.showHiddenItems || !hidden) && regex.test(f.name);
      }).map(f => ({
        name: f.name,
        type: f.isDirectory ? 'folder' : 'file',
        size: f.size,
        modifyTime: f.modifiedAt,
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

module.exports = { FtpFileExplorer };
