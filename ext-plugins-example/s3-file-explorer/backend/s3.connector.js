const { EventEmitter } = require('events');

class S3FileExplorer extends EventEmitter {
  constructor(log) {
    super();
    this.log = log;
    this._client = null;
    this._bucket = null;
    this._config = null;
  }

  setConfig(config) {
    this._config = config;
    this._bucket = config.bucket;

    if (!this._bucket) {
      throw new Error('S3 bucket name is required');
    }
    if (!config.accessKeyId || !config.secretAccessKey) {
      throw new Error('S3 credentials (accessKeyId, secretAccessKey) are required');
    }

    this.log.info(`[S3] Configured for bucket: ${this._bucket}, region: ${config.region || 'us-east-1'}`);
  }

  _getClient() {
    if (this._client) return this._client;

    const { S3Client } = require('@aws-sdk/client-s3');
    const opts = {
      region: this._config.region || 'us-east-1',
      credentials: {
        accessKeyId: this._config.accessKeyId,
        secretAccessKey: this._config.secretAccessKey,
      },
      forcePathStyle: this._config.forcePathStyle !== false,
    };
    if (this._config.endpoint) {
      opts.endpoint = this._config.endpoint;
    }
    this._client = new S3Client(opts);
    return this._client;
  }

  _toPrefix(remotePath) {
    if (!remotePath || remotePath === '/') return '';
    return remotePath.replace(/^\/|\/$/g, '') + '/';
  }

  async listFiles(remotePath) {
    const { ListObjectsV2Command } = require('@aws-sdk/client-s3');
    const prefix = this._toPrefix(remotePath);
    const client = this._getClient();

    const command = new ListObjectsV2Command({
      Bucket: this._bucket,
      Prefix: prefix,
      Delimiter: '/',
      MaxKeys: 1000,
    });

    const response = await client.send(command);
    const files = [];

    // CommonPrefixes = "folders"
    for (const cp of (response.CommonPrefixes || [])) {
      const name = cp.Prefix.replace(prefix, '').replace(/\/$/, '');
      if (name) {
        files.push({
          name,
          type: 'folder',
          isFile: false,
          size: 0,
          dateModified: '',
        });
      }
    }

    // Contents = "files" (skip the prefix itself if it's a "folder" marker)
    for (const obj of (response.Contents || [])) {
      const key = obj.Key;
      if (key === prefix && key.endsWith('/')) continue; // skip folder marker
      const name = key.replace(prefix, '');
      if (name && !name.includes('/')) {
        files.push({
          name,
          type: 'file',
          isFile: true,
          size: obj.Size || 0,
          dateModified: obj.LastModified ? obj.LastModified.toISOString() : '',
        });
      }
    }

    return files;
  }

  async readFile(remotePath) {
    const { GetObjectCommand } = require('@aws-sdk/client-s3');
    const key = remotePath.replace(/^\//, '');
    const client = this._getClient();

    const command = new GetObjectCommand({
      Bucket: this._bucket,
      Key: key,
    });

    const response = await client.send(command);
    const chunks = [];
    for await (const chunk of response.Body) {
      chunks.push(chunk);
    }
    return Buffer.concat(chunks);
  }

  async writeFile(remotePath, data) {
    const { PutObjectCommand } = require('@aws-sdk/client-s3');
    const key = remotePath.replace(/^\//, '');
    const client = this._getClient();

    const command = new PutObjectCommand({
      Bucket: this._bucket,
      Key: key,
      Body: data,
    });

    await client.send(command);
  }

  async deleteFile(remotePath) {
    const { DeleteObjectCommand } = require('@aws-sdk/client-s3');
    const key = remotePath.replace(/^\//, '');
    const client = this._getClient();

    const command = new DeleteObjectCommand({
      Bucket: this._bucket,
      Key: key,
    });

    await client.send(command);
  }

  async deleteBatch(items) {
    const { DeleteObjectsCommand } = require('@aws-sdk/client-s3');
    const client = this._getClient();

    // S3 DeleteObjects supports max 1000 per request
    const BATCH_SIZE = 1000;
    for (let i = 0; i < items.length; i += BATCH_SIZE) {
      const batch = items.slice(i, i + BATCH_SIZE);
      const command = new DeleteObjectsCommand({
        Bucket: this._bucket,
        Delete: {
          Objects: batch.map(item => ({ Key: item.Key })),
          Quiet: true,
        },
      });
      await client.send(command);
    }
  }

  async copyFile(srcKey, destKey) {
    const { CopyObjectCommand } = require('@aws-sdk/client-s3');
    const client = this._getClient();

    const command = new CopyObjectCommand({
      Bucket: this._bucket,
      CopySource: `${this._bucket}/${srcKey}`,
      Key: destKey,
    });

    await client.send(command);
  }

  async renameFile(oldPath, newPath) {
    const srcKey = oldPath.replace(/^\//, '');
    const destKey = newPath.replace(/^\//, '');
    await this.copyFile(srcKey, destKey);
    await this.deleteFile(srcKey);
  }

  async createFolder(remotePath, folderName) {
    const { PutObjectCommand } = require('@aws-sdk/client-s3');
    const prefix = this._toPrefix(remotePath);
    const key = prefix + folderName + '/';
    const client = this._getClient();

    const command = new PutObjectCommand({
      Bucket: this._bucket,
      Key: key,
      Body: '',
    });

    await client.send(command);
  }

  async search(remotePath, searchString) {
    const { ListObjectsV2Command } = require('@aws-sdk/client-s3');
    const prefix = this._toPrefix(remotePath);
    const client = this._getClient();

    // Search by prefix first (fast), then filter by contains
    const searchPrefix = prefix + searchString;
    const command = new ListObjectsV2Command({
      Bucket: this._bucket,
      Prefix: searchPrefix,
      Delimiter: '/',
      MaxKeys: 1000,
    });

    const response = await client.send(command);
    const files = [];

    for (const cp of (response.CommonPrefixes || [])) {
      const name = cp.Prefix.replace(prefix, '').replace(/\/$/, '');
      if (name && name.toLowerCase().includes(searchString.toLowerCase())) {
        files.push({
          name,
          type: 'folder',
          isFile: false,
          size: 0,
          dateModified: '',
        });
      }
    }

    for (const obj of (response.Contents || [])) {
      const name = obj.Key.replace(prefix, '');
      if (name && !name.includes('/') && name.toLowerCase().includes(searchString.toLowerCase())) {
        files.push({
          name,
          type: 'file',
          isFile: true,
          size: obj.Size || 0,
          dateModified: obj.LastModified ? obj.LastModified.toISOString() : '',
        });
      }
    }

    return files;
  }

  async disconnect() {
    this._client = null;
    this._bucket = null;
    this._config = null;
    this.emit('disconnected');
  }
}

module.exports = { S3FileExplorer };
