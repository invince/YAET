const EventEmitter = require('events');

class TerminalRuntimeApi extends EventEmitter {
  async connect(options) { throw new Error('not implemented'); }
  async write(data) { throw new Error('not implemented'); }
  async resize(cols, rows) { throw new Error('not implemented'); }
  async close() { throw new Error('not implemented'); }
  async exec(command) { throw new Error('not implemented'); }
}

class DockerExecSession extends TerminalRuntimeApi {
  constructor(log, config) {
    super();
    this.log = log;
    this._initialConfig = config || null;
    this.docker = null;
    this.container = null;
    this.exec = null;
    this.stream = null;
    this._connected = false;
  }

  async connect(options = {}) {
    const merged = { ...(this._initialConfig || {}), ...options };

    if (!merged.container || !merged.container.trim()) {
      throw new Error('Container ID or name is required');
    }

    const Docker = require('dockerode');

    let dockerOpts = {};
    if (merged.socketPath) {
      dockerOpts.socketPath = merged.socketPath;
    } else if (merged.host && merged.port) {
      dockerOpts.host = merged.host;
      dockerOpts.port = parseInt(merged.port, 10);
    } else {
      dockerOpts.socketPath = process.platform === 'win32'
        ? '//./pipe/docker_engine'
        : '/var/run/docker.sock';
    }

    this.docker = new Docker(dockerOpts);

    await this._ping();

    this.container = this.docker.getContainer(merged.container.trim());
    const containerInfo = await this.container.inspect();
    if (!containerInfo.State.Running) {
      throw new Error(`Container "${merged.container}" is not running`);
    }

    const cmd = merged.command ? merged.command.trim().split(/\s+/) : ['/bin/bash'];
    this.exec = await this.container.exec({
      Cmd: cmd,
      AttachStdout: true,
      AttachStderr: true,
      AttachStdin: true,
      Tty: true,
    });

    this.stream = await this.exec.start({ Tty: true, Detach: false, hijack: true });

    this.stream.on('data', (data) => {
      this.emit('output', { data: data.toString('utf-8') });
    });

    this.stream.on('end', () => {
      this._connected = false;
      this.emit('disconnect', { error: null });
    });

    this.stream.on('error', (err) => {
      this.log.error('[docker] Stream error:', err);
      this.emit('error', { error: err.message });
    });

    this.stream.on('close', () => {
      this._connected = false;
      this.emit('disconnect', { error: null });
    });

    this._connected = true;
    this.emit('connected');
  }

  async _ping() {
    try {
      await this.docker.ping();
    } catch (err) {
      throw new Error(`Cannot connect to Docker daemon: ${err.message}`);
    }
  }

  async write(data) {
    if (this.stream && this._connected) {
      return new Promise((resolve, reject) => {
        const flushed = this.stream.write(data);
        if (flushed) {
          resolve(true);
        } else {
          this.stream.once('drain', () => resolve(true));
        }
      });
    }
    return false;
  }

  async resize(cols, rows) {
    if (this.exec) {
      try {
        await this.exec.resize({ h: parseInt(rows, 10), w: parseInt(cols, 10) });
      } catch (err) {
        this.log.warn('[docker] Resize error:', err.message);
      }
    }
  }

  async close() {
    if (this.stream) {
      try {
        this.stream.destroy();
      } catch {}
      this.stream = null;
    }
    this.exec = null;
    this.container = null;
    this.docker = null;
    this._connected = false;
  }
}

module.exports = { DockerExecSession };
