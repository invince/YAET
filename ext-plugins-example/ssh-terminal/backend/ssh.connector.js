const EventEmitter = require('events');

class TerminalRuntimeApi extends EventEmitter {
  async connect(options) { throw new Error('not implemented'); }
  async write(data) { throw new Error('not implemented'); }
  async resize(cols, rows) { throw new Error('not implemented'); }
  async close() { throw new Error('not implemented'); }
}

class SshTerminalSession extends TerminalRuntimeApi {
  constructor(log, projectRequire) {
    super();
    this.log = log;
    this._projectRequire = projectRequire;
    this.conn = null;
    this.stream = null;
    this._connected = false;
  }

  async connect(options = {}) {
    const {Client} = this._projectRequire('ssh2');
    const { proxy, proxyService, secretRepo, initPath, initCmd, rows, cols, id, ...sshConfig } = options;

    sshConfig.debug = (info) => this.log.info('SSH DEBUG:', info);

    if (proxy && proxy.id && proxyService) {
      const sock = await proxyService.createProxyConnection(proxy, sshConfig.host, sshConfig.port || 22, secretRepo);
      sshConfig.sock = sock;
    }

    return new Promise((resolve, reject) => {
      const conn = new Client();
      conn.on('ready', () => {
        conn.shell({ term: 'xterm-256color' }, (err, stream) => {
          if (err) { reject(err); return; }
          if (initPath) stream.write(`cd ${initPath.replace(/[\r\n]/g, '')}\n`);
          if (initCmd) stream.write(`${initCmd.replace(/[\r\n]/g, '')}\n`);
          stream.on('data', (data) => this.emit('output', { data: data.toString() }));
          if (rows && cols) stream.setWindow(rows, cols, null, null);
          this.conn = conn;
          this.stream = stream;
          this._connected = true;
          resolve();
        });
      });
      conn.on('error', (err) => {
        this.emit('error', { error: `SSH connection error: ${err.message}` });
        if (!this._connected) reject(err);
      });
      conn.on('close', () => {
        this._connected = false;
        this.conn = null;
        this.stream = null;
        this.emit('disconnect', {});
      });
      conn.connect(sshConfig);
    });
  }

  async write(data) {
    if (this.stream) { this.stream.write(data); return true; }
    return false;
  }

  async resize(cols, rows) {
    if (this.stream) this.stream.setWindow(rows, cols, null, null);
  }

  async close() {
    if (this.conn) { this.conn.end(); this.conn = null; this.stream = null; this._connected = false; }
  }
}

module.exports = { SshTerminalSession };
