import {Injectable} from '@angular/core';
import {CustomProfile} from '../../domain/profile/CustomProfile';
import {LocalTerminalProfile} from '../../domain/profile/LocalTerminalProfile';
import {Profile,} from '../../domain/profile/Profile';
import {AuthType, SecretType} from '../../domain/Secret';
import {Session} from '../../domain/session/Session';
import {SecretStorageService} from '../secret-storage.service';
import {AbstractElectronService} from './electron.service';
import {
  SESSION_CLOSE_LOCAL_TERMINAL,
  SESSION_OPEN_CUSTOM,
  SESSION_OPEN_LOCAL_TERMINAL,
  TERMINAL_INPUT,
  TERMINAL_OUTPUT,
  TERMINAL_RESIZE
} from './ElectronConstant';


@Injectable({
  providedIn: 'root',
})
export class ElectronTerminalService extends AbstractElectronService {

  constructor(
    private secretStorage: SecretStorageService,
  ) {
    super();
  }

  closeLocalTerminalSession(session: Session) {
    if (this.ipc) {
      this.ipc.send(SESSION_CLOSE_LOCAL_TERMINAL, { id: session.id });
    }
  }

  openLocalTerminalSession(session: Session) {
    if (!this.ipc) {
      this.log({ level: 'error', message: "Invalid configuration" });
      return;
    }
    if (!session.profile) {
      session.profile = new Profile();
    }
    if (!session.profile.hasProfile('LOCAL_TERMINAL')) {
      session.profile.setProfile('LOCAL_TERMINAL', new LocalTerminalProfile());
    }
    let localProfile: LocalTerminalProfile = session.profile.getProfile('LOCAL_TERMINAL');
    this.ipc.send(SESSION_OPEN_LOCAL_TERMINAL, { id: session.id, terminalExec: localProfile.execPath });
  }

  sendTerminalInput(terminalId: string, input: string) {
    if (this.ipc) {
      this.ipc.send(TERMINAL_INPUT, { id: terminalId, input: input });
    }
  }

  private terminalOutputHandlers = new Map<string, Set<(data: TermOutput) => void>>();
  private terminalOutputListenerInit = false;

  onTerminalOutput(terminalId: string, callback: (data: TermOutput) => void): () => void {
    if (!this.ipc) return () => {};

    if (!this.terminalOutputHandlers.has(terminalId)) {
      this.terminalOutputHandlers.set(terminalId, new Set());
    }
    this.terminalOutputHandlers.get(terminalId)!.add(callback);

    if (!this.terminalOutputListenerInit) {
      this.terminalOutputListenerInit = true;
      this.ipc.on(TERMINAL_OUTPUT, (event, data: TermOutput) => {
        const cbs = this.terminalOutputHandlers.get(data?.id);
        if (cbs) {
          cbs.forEach(cb => cb(data));
        }
      });
    }

    return () => {
      const cbs = this.terminalOutputHandlers.get(terminalId);
      if (cbs) {
        cbs.delete(callback);
        if (cbs.size === 0) {
          this.terminalOutputHandlers.delete(terminalId);
        }
      }
    };
  }

  openCustomSession(customProfile: CustomProfile) {
    if (this.ipc) {
      let cmd = customProfile.execPath;
      if (!cmd) {
        return;
      }
      if (cmd.includes('$login') || cmd.includes('$password')) {
        if (customProfile.authType == AuthType.SECRET) {
          let secret = this.secretStorage.findById(customProfile.secretId);
          if (!secret) {
            this.log({ level: 'error', message: "Invalid secret " + customProfile.secretId });
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

        const escapeArg = (val: string | undefined) => {
          if (!val) return '';
          const escaped = val.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
          return `"${escaped}"`;
        };
        cmd = cmd.replaceAll('$login', escapeArg(customProfile.login));
        cmd = cmd.replaceAll('$password', escapeArg(customProfile.password));
      }

      this.ipc.send(SESSION_OPEN_CUSTOM, { command: cmd });
    }
  }

  sendTerminalResize(terminalId: string, cols: number | undefined, rows: number | undefined) {
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
