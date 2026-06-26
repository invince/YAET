const { EventEmitter } = require('events');
const http = require('http');
const https = require('https');

class WebDavFileExplorer extends EventEmitter {
  constructor(log) {
    super();
    this.log = log;
    this._baseUrl = null;
    this._authHeader = null;
    this._config = null;
  }

  setConfig(config) {
    this._config = config;
    const urlStr = (config.url || '').trim();
    if (!urlStr) {
      throw new Error('WebDAV URL is required');
    }
    let parsed;
    try {
      parsed = new URL(urlStr);
    } catch {
      throw new Error(`Invalid WebDAV URL: "${urlStr}"`);
    }
    if (!parsed.protocol || !parsed.hostname) {
      throw new Error(`Invalid WebDAV URL: "${urlStr}" — must include protocol and host`);
    }
    const base = parsed.origin.replace(/\/$/, '');
    const root = (parsed.pathname + parsed.search).replace(/\/$/, '') || '/';
    this._baseUrl = base;
    this._rootPath = root;
    const user = parsed.username || config.username;
    const pass = parsed.password || config.password;
    if (user) {
      this._authHeader = 'Basic ' + Buffer.from(`${user}:${pass || ''}`).toString('base64');
    }
    this.log.info(`[WebDAV] Configured for ${parsed.origin}`);
  }

  async connect(config) {
    this.setConfig(config);
    this.emit('connected');
  }

  _request(method, path, headers, body) {
    const url = new URL(path, this._baseUrl);
    const allHeaders = { ...headers };
    if (this._authHeader) {
      allHeaders['Authorization'] = this._authHeader;
    }
    const opts = {
      method,
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      headers: allHeaders,
      rejectUnauthorized: false,
    };

    const mod = url.protocol === 'https:' ? https : http;

    return new Promise((resolve, reject) => {
      const req = mod.request(opts, (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          const data = Buffer.concat(chunks);
          resolve({ status: res.statusCode, headers: res.headers, data });
        });
      });
      req.on('error', reject);
      if (body) req.write(body);
      req.end();
    });
  }

  async _propfind(urlPath, depth = 1) {
    const res = await this._request('PROPFIND', urlPath, {
      'Depth': String(depth),
      'Content-Type': 'application/xml; charset="utf-8"',
    });
    if (res.status >= 300) {
      throw new Error(`WebDAV PROPFIND ${urlPath} failed: ${res.status}`);
    }
    return this._parsePropfind(res.data.toString());
  }

  _parsePropfind(xml) {
    const items = [];
    const extract = (block, tag) => {
      const re = new RegExp(`<[^>]*${tag}[^>]*>([\\s\\S]*?)<\\/[^>]*${tag}[^>]*>`, 'i');
      const m = re.exec(block);
      return m ? m[1] : '';
    };
    const responseRe = new RegExp(`<[^>]*response[^>]*>([\\s\\S]*?)<\\/[^>]*response[^>]*>`, 'gi');
    let match;
    while ((match = responseRe.exec(xml)) !== null) {
      const block = match[1];
      const href = extract(block, 'href');
      if (!href) continue;

      const isCollection = /<[^>]*collection\s*\/?>/i.test(block);
      const name = decodeURIComponent(href.replace(/\/$/, '').split('/').pop() || '/');

      let size = 0;
      const sizeStr = extract(block, 'getcontentlength');
      if (sizeStr) size = parseInt(sizeStr, 10) || 0;

      let modifiedAt = extract(block, 'getlastmodified');

      items.push({
        name,
        type: isCollection ? 'folder' : 'file',
        isFile: !isCollection,
        size,
        dateModified: modifiedAt,
        path: href,
      });
    }
    return items;
  }

  _resolvePath(remotePath) {
    if (!remotePath || remotePath === '/') return this._rootPath;
    return this._rootPath.replace(/\/$/, '') + '/' + remotePath.replace(/^\//, '');
  }

  async listFiles(remotePath) {
    const fullPath = this._resolvePath(remotePath);
    const entries = await this._propfind(fullPath);
    const reqPath = fullPath.replace(/\/$/, '');
    return entries.filter(e => {
      const entryPath = e.path.replace(/\/$/, '');
      return entryPath !== reqPath;
    }).map(e => {
      const { path: _p, ...rest } = e;
      return rest;
    });
  }

  async readFile(remotePath) {
    const fullPath = this._resolvePath(remotePath);
    const res = await this._request('GET', fullPath);
    if (res.status >= 300) throw new Error(`WebDAV GET ${fullPath} failed: ${res.status}`);
    return res.data;
  }

  async writeFile(remotePath, data) {
    const fullPath = this._resolvePath(remotePath);
    const res = await this._request('PUT', fullPath, {
      'Content-Type': 'application/octet-stream',
    }, data);
    if (res.status >= 300) throw new Error(`WebDAV PUT ${fullPath} failed: ${res.status}`);
  }

  async deleteFile(remotePath) {
    const fullPath = this._resolvePath(remotePath);
    const res = await this._request('DELETE', fullPath);
    if (res.status >= 300) throw new Error(`WebDAV DELETE ${fullPath} failed: ${res.status}`);
  }

  async renameFile(oldPath, newPath) {
    const oldFull = this._resolvePath(oldPath);
    const newFull = this._resolvePath(newPath);
    const destination = new URL(newFull, this._baseUrl).href;
    const res = await this._request('MOVE', oldFull, {
      'Destination': destination,
    });
    if (res.status >= 300) throw new Error(`WebDAV MOVE ${oldPath} failed: ${res.status}`);
  }

  async disconnect() {
    this._baseUrl = null;
    this._authHeader = null;
    this._config = null;
    this.emit('disconnected');
  }
}

module.exports = { WebDavFileExplorer };
