const pty = require('node-pty');
const EventEmitter = require('events');

class LocalTerminalService extends EventEmitter {
  constructor(log) {
    super();
    this.log = log;
    this.sessions = new Map();
  }

  validateShell(terminalExec) {
    if (!terminalExec) {
      return process.platform === 'win32' ? 'cmd.exe' : 'bash';
    }
    return terminalExec;
  }

  connect(config, options = {}) {
    const { id } = options;
    const terminalExec = config?.terminalExec;

    this.log.info('Local Terminal ' + id + ' ready');
    let shell = this.validateShell(terminalExec);

    const ptyProcess = pty.spawn(shell, [], {
      name: 'xterm-color',
      rows: 30,
      cwd: process.env.HOME,
      env: process.env,
      useConpty: false,
    });

    ptyProcess.onData((data) => {
      this.emit('output', { id, data: data.toString() });
    });

    ptyProcess.on('error', (err) => {
      this.log.error(`Error in terminal ${id}:`, err);
    });

    const session = {
      type: 'local',
      process: ptyProcess,
      callback: (data) => ptyProcess.write(data),
    };

    this.sessions.set(id, session);
    return session;
  }

  disconnect(id) {
    const session = this.sessions.get(id);
    if (session && session.process) {
      session.process.kill();
    }
    this.sessions.delete(id);
    this.log.info('Local Terminal ' + id + ' closed');
  }

  write(id, data) {
    const session = this.sessions.get(id);
    if (session && session.callback) {
      session.callback(data);
      return true;
    }
    return false;
  }

  resize(id, cols, rows) {
    const session = this.sessions.get(id);
    if (session && session.type === 'local') {
      session.process.resize(cols, rows);
    }
  }
}

module.exports = { LocalTerminalService };
