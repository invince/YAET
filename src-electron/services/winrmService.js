const pty = require('node-pty');
const EventEmitter = require('events');

class WinRMService extends EventEmitter {
  constructor(log) {
    super();
    this.log = log;
    this.sessions = new Map();
  }

  connect(config, options = {}) {
    const { id, initPath, initCmd, settings } = options;
    const { host, username, password } = config;

    this.log.info(`WinRM Terminal ${id} initializing`);

    let localTermForWinRM = 'powershell.exe';
    if (settings?.terminal?.localTerminal?.type === 'powershell 7') {
      localTermForWinRM = 'pwsh.exe';
    }

    const ptyProcess = pty.spawn(localTermForWinRM, [], {
      name: 'xterm-color',
      rows: 30,
      cwd: process.env.HOME,
      env: process.env,
      useConpty: false,
    });

    let initialized = false;

    ptyProcess.onData((data) => {
      if (!initialized) {
        if (data.includes('Enter-PSSession')) {
          initialized = true;
          this.log.info(`WinRM Terminal ${id} session established`);
          this.emit('opened', { id });
        }
      } else {
        this.emit('output', { id, data: data.toString() });
      }
    });

    ptyProcess.on('error', (data) => {
      this.log.error(`Error in WinRM Terminal ${id}: ${data.toString()}`);
      this.emit('error', { id, error: data.toString() });
    });

    ptyProcess.on('close', (code) => {
      this.log.info(`WinRM Terminal ${id} closed with code ${code}`);
      this.sessions.delete(id);
      this.emit('closed', { id });
    });

    const session = {
      type: 'winrm',
      process: ptyProcess,
      callback: (data) => {
        ptyProcess.write(data);
      },
    };

    this.sessions.set(id, session);

    const esc = (s) => (s || '').replace(/'/g, "''");
    let connectionCommand = [];
    if (password && username) {
      connectionCommand = [
        `$secPassword = ConvertTo-SecureString '${esc(password)}' -AsPlainText -Force`,
        `$cred = New-Object System.Management.Automation.PSCredential('${esc(username)}', $secPassword)`,
        `Enter-PSSession -ComputerName '${esc(host)}' -Credential $cred`,
      ];
    } else {
      connectionCommand = [`Enter-PSSession -ComputerName '${esc(host)}'`];
    }

    for (const oneCmd of connectionCommand) {
      ptyProcess.write(oneCmd + '\r');
    }

    if (initPath) {
      ptyProcess.write(`cd ${initPath}\r`);
    }
    if (initCmd) {
      ptyProcess.write(`${initCmd}\r`);
    }

    return session;
  }

  disconnect(id) {
    const session = this.sessions.get(id);
    if (session && session.type === 'winrm') {
      session.process.kill();
      this.sessions.delete(id);
      this.log.info(`WinRM Terminal ${id} closed`);
    }
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
    if (session && session.type === 'winrm') {
      session.process.resize(cols, rows);
    }
  }
}

module.exports = { WinRMService };
