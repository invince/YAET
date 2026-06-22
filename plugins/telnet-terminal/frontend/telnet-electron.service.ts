/**
 * Telnet Terminal Plugin - Frontend Electron Service
 *
 * Handles IPC communication for Telnet sessions.
 * Migrated from ElectronTerminalService's telnet methods.
 */
import {Injectable} from '@angular/core';
import {SecretStorageService} from '../../../src/app/services/secret-storage.service';
import {TabService} from '../../../src/app/services/tab.service';
import {NotificationService} from '../../../src/app/services/notification.service';
import {Session} from '../../../src/app/domain/session/Session';
import {resolveSecretToConfig} from '../../../src/app/utils/SecretResolver';

declare const window: any;

@Injectable({ providedIn: 'root' })
export class TelnetElectronService {
  private ipc = window.electronAPI;

  constructor(
    private secretStorage: SecretStorageService,
    private tabService: TabService,
    private notification: NotificationService,
  ) {}

  openTelnetTerminalSession(session: Session) {
    if (!this.ipc || !session.profile || !session.profile.telnetProfile) {
      return;
    }

    const telnetConfig: any = {
      timeout: 1500,
      negotiationMandatory: false,
    };

    const telnetProfile = session.profile.telnetProfile;
    telnetConfig.host = telnetProfile.host;
    telnetConfig.port = telnetProfile.port;

    if (!resolveSecretToConfig(telnetConfig, telnetProfile, this.secretStorage, (m) => console.log(m))) {
      return;
    }

    const data: {[key: string]: any} = {
      terminalId: session.id,
      config: telnetConfig,
    };

    if (session.profile.proxyId) {
      data['proxyId'] = session.profile.proxyId;
    }
    if (telnetProfile.initPath) {
      data['initPath'] = telnetProfile.initPath;
    }
    if (telnetProfile.initCmd) {
      data['initCmd'] = telnetProfile.initCmd;
    }

    this.ipc.send('session.open.terminal.telnet', data);
  }

  closeTelnetTerminalSession(session: Session) {
    if (this.ipc) {
      this.ipc.send('session.close.terminal.telnet', { terminalId: session.id });
    }
  }
}
