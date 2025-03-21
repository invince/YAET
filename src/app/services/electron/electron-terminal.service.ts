import {Injectable} from '@angular/core';
import {
  ERROR,
  SESSION_CLOSE_LOCAL_TERMINAL,
  SESSION_CLOSE_SSH_TERMINAL,
  SESSION_CLOSE_TELNET_TERMINAL,
  SESSION_CLOSE_WINRM_TERMINAL,
  SESSION_DISCONNECT_SSH,
  SESSION_OPEN_CUSTOM,
  SESSION_OPEN_LOCAL_TERMINAL,
  SESSION_OPEN_SSH_TERMINAL,
  SESSION_OPEN_TELNET_TERMINAL,
  SESSION_OPEN_WINRM_TERMINAL,
  TERMINAL_INPUT,
  TERMINAL_OUTPUT,
  TERMINAL_RESIZE
} from './ElectronConstant';
import {LocalTerminalProfile} from '../../domain/profile/LocalTerminalProfile';
import {Profile,} from '../../domain/profile/Profile';
import {AuthType, SecretType} from '../../domain/Secret';
import {SecretStorageService} from '../secret-storage.service';
import {TabService} from '../tab.service';
import {Session} from '../../domain/session/Session';
import {NotificationService} from '../notification.service';
import {AbstractElectronService} from './electron.service';
import {CustomProfile} from '../../domain/profile/CustomProfile';


@Injectable({
  providedIn: 'root',
})
export class ElectronTerminalService extends AbstractElectronService {

  constructor(
    private secretStorage: SecretStorageService,
    private notification: NotificationService,

    private tabService: TabService,
  ) {
    super();
    this.initTerminalListener();
  }


  private initTerminalListener() {
    this.ipc.on(ERROR, (event, data) => {
      if (data.category == 'ssh') {
        this.tabService.removeById(data.id);
      }
      return;
    });

    this.ipc.on(SESSION_DISCONNECT_SSH, (event, data) => {
      this.log({level: 'info', message: 'SSH Disconnected:' + data.id});
      if (data.error) {
        this.notification.error('SSH Disconnected, you can try reconnect later');
      }
      this.tabService.disconnected(data.id);
      // Handle disconnection logic
    });
  }

  closeTelnetTerminalSession(session: Session) {
    if (this.ipc) {
      this.ipc.send(SESSION_CLOSE_TELNET_TERMINAL, {terminalId: session.id});
    }
  }

  closeSSHTerminalSession(session: Session) {
    if (this.ipc) {
      this.ipc.send(SESSION_CLOSE_SSH_TERMINAL, {terminalId: session.id});
    }
  }

  closeLocalTerminalSession(session: Session) {
    if (this.ipc) {
      this.ipc.send(SESSION_CLOSE_LOCAL_TERMINAL, {terminalId: session.id});
    }
  }

  closeWinRMTerminalSession(session: Session) {
    if (this.ipc) {
      this.ipc.send(SESSION_CLOSE_WINRM_TERMINAL, {terminalId: session.id});
    }
  }


  openLocalTerminalSession(session: Session) {
    if (!this.ipc) {
      this.log({level: 'error', message : "Invalid configuration"});
      return;
    }
    if (!session.profile) {
      session.profile = new Profile();
    }
    if (!session.profile.localTerminal) {
      session.profile.localTerminal = new LocalTerminalProfile();
    }
    let localProfile: LocalTerminalProfile = session.profile.localTerminal;
    this.ipc.send(SESSION_OPEN_LOCAL_TERMINAL, {terminalId: session.id, terminalExec: localProfile.execPath});
  }

  openTelnetTerminalSession(session: Session) {
    if (!this.ipc || !session.profile || !session.profile.telnetProfile) {
      this.log({level: 'error', message : "Invalid configuration"});
      return;
    }
    let telnetConfig: any = {
      timeout: 1500,           // Wait up to 30 seconds for the connection.
      negotiationMandatory: false,      // Send keepalive packets every 15 seconds.

    };

    let telnetProfile = session.profile.telnetProfile;
    telnetConfig.host = telnetProfile.host;
    telnetConfig.port = telnetProfile.port;
    if (telnetProfile.authType == AuthType.LOGIN) {
      telnetConfig.username = telnetProfile.login;
      telnetConfig.password = telnetProfile.password;
    } else if (telnetProfile.authType == AuthType.SECRET) {
      let secret = this.secretStorage.findById(telnetProfile.secretId);
      if (!secret) {
        this.log({level: 'error', message : "Invalid secret " + telnetProfile.secretId});
        return;
      }
      switch (secret.secretType) {
        case SecretType.LOGIN_PASSWORD: {
          telnetConfig.username = secret.login;
          telnetConfig.password = secret.password;
          break;
        }
        case SecretType.SSH_KEY: {
          telnetConfig.username = secret.login;
          telnetConfig.privateKey = secret.key.replace(/\\n/g, '\n');
          if (secret.passphrase) {
            telnetConfig.passphrase = secret.passphrase;
          }
          break;
        }
        case SecretType.PASSWORD_ONLY: {
          // todo
          break;
        }
      }
    }
    let data: {[key: string]: any;} = {terminalId: session.id, config: telnetConfig};
    if (telnetProfile.initPath) {
      data['initPath'] = telnetProfile.initPath;
    }
    if (telnetProfile.initCmd) {
      data['initCmd'] = telnetProfile.initCmd;
    }
    this.ipc.send(SESSION_OPEN_TELNET_TERMINAL, data);
  }

  openSSHTerminalSession(session: Session) {
    if (!this.ipc || !session.profile || !session.profile.sshProfile) {
      this.log({level: 'error', message : "Invalid configuration"});
      return;
    }

    let sshConfig: any = {
      readyTimeout: 30000,           // Wait up to 30 seconds for the connection.
      keepaliveInterval: 15000,      // Send keepalive packets every 15 seconds.
      keepaliveCountMax: 5,          // Disconnect after 5 failed keepalive packets.

    };
    let sshProfile = session.profile.sshProfile;
    sshConfig.host = sshProfile.host;
    sshConfig.port = sshProfile.port;
    if (sshProfile.authType == AuthType.LOGIN) {
      sshConfig.username = sshProfile.login;
      sshConfig.password = sshProfile.password;
    } else if (sshProfile.authType == AuthType.SECRET) {
      let secret = this.secretStorage.findById(sshProfile.secretId);
      if (!secret) {
        this.log({level: 'error', message : "Invalid secret " + sshProfile.secretId});
        return;
      }
      switch (secret.secretType) {
        case SecretType.LOGIN_PASSWORD: {
          sshConfig.username = secret.login;
          sshConfig.password = secret.password;
          break;
        }
        case SecretType.SSH_KEY: {
          sshConfig.username = secret.login;
          sshConfig.privateKey = secret.key.replace(/\\n/g, '\n');
          if (secret.passphrase) {
            sshConfig.passphrase = secret.passphrase;
          }
          break;
        }
        case SecretType.PASSWORD_ONLY: {
          // todo
          break;
        }
      }
    }
    let data: {[key: string]: any;} = {terminalId: session.id, config: sshConfig};
    if (sshProfile.initPath) {
      data['initPath'] = sshProfile.initPath;
    }
    if (sshProfile.initCmd) {
      data['initCmd'] = sshProfile.initCmd;
    }
    this.ipc.send(SESSION_OPEN_SSH_TERMINAL, data);
  }


  openWinRMTerminalSession(session: Session) {
    if (!this.ipc || !session.profile || !session.profile.sshProfile) {
      this.log({level: 'error', message : "Invalid configuration"});
      return;
    }

    let config: any = {
      executionPolicy: 'Bypass',
      noProfile: true,

    };
    let profile = session.profile.winRmProfile;
    config.host = profile.host;
    config.port = profile.port;
    if (profile.authType == AuthType.LOGIN) {
      config.username = profile.login;
      config.password = profile.password;
    } else if (profile.authType == AuthType.SECRET) {
      let secret = this.secretStorage.findById(profile.secretId);
      if (!secret) {
        this.log({level: 'error', message : "Invalid secret " + profile.secretId});
        return;
      }
      switch (secret.secretType) {
        case SecretType.LOGIN_PASSWORD: {
          config.username = secret.login;
          config.password = secret.password;
          break;
        }
        case SecretType.SSH_KEY: {
          config.username = secret.login;
          config.privateKey = secret.key.replace(/\\n/g, '\n');
          if (secret.passphrase) {
            config.passphrase = secret.passphrase;
          }
          break;
        }
        case SecretType.PASSWORD_ONLY: {
          // todo
          break;
        }
      }
    }
    let data: {[key: string]: any;} = {terminalId: session.id, config: config};
    if (profile.initPath) {
      data['initPath'] = profile.initPath;
    }
    if (profile.initCmd) {
      data['initCmd'] = profile.initCmd;
    }
    this.ipc.send(SESSION_OPEN_WINRM_TERMINAL, data);
  }


  sendTerminalInput(terminalId: string, input: string) {
    if(this.ipc) {
      this.ipc.send(TERMINAL_INPUT, {terminalId: terminalId, input: input});
    }
  }

  onTerminalOutput(terminalId: string , callback: (data: TermOutput) => void) {
    if(this.ipc) {
      this.ipc.on(TERMINAL_OUTPUT, (event, data) => {
        if (data && data.id == terminalId) {
          callback(data);
        }
      });
    }
  }

  openCustomSession(customProfile: CustomProfile) {
    if (this.ipc) {
      let cmd = customProfile.execPath;
      if (!cmd) {
        return;
      }
      if (cmd.includes('$login') || cmd.includes('$password')) {
        if(customProfile.authType == AuthType.SECRET) {
          let secret = this.secretStorage.findById(customProfile.secretId);
          if (!secret) {
            this.log({level: 'error', message : "Invalid secret " + customProfile.secretId});
            return;
          }
          switch (secret.secretType) {
            case SecretType.LOGIN_PASSWORD: {
              customProfile.login = secret.login;
              customProfile.password = secret.password;
              break;
            }

            case SecretType.PASSWORD_ONLY: {
              customProfile.password = secret.password;
              break;
            }
          }
        }

        cmd = cmd.replaceAll('$login', customProfile.login);
        cmd = cmd.replaceAll('$password', customProfile.password);
      }

      this.ipc.send(SESSION_OPEN_CUSTOM, { command: cmd });
    }
  }

  sendTerminalResize(terminalId: string, cols: number | undefined, rows: number| undefined) {
    this.ipc.send(TERMINAL_RESIZE, {
      id: terminalId,
      cols: cols,
      rows: rows
    });
  }
}

export class TermOutput {
  id!: string;
  data!: string
}
