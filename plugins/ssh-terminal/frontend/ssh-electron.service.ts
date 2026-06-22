/**
 * SSH Terminal Plugin - Frontend Electron Service
 *
 * Handles IPC communication for SSH sessions.
 * Uses window.electronAPI (exposed by preload.js) directly.
 *
 * Migrated from the SSH-specific methods in
 * src/app/services/electron/electron-terminal.service.ts
 */
import {Injectable} from '@angular/core';
import {SecretStorageService} from '../../../src/app/services/secret-storage.service';
import {TabService} from '../../../src/app/services/tab.service';
import {NotificationService} from '../../../src/app/services/notification.service';
import {Session} from '../../../src/app/domain/session/Session';
import {resolveSecretToConfig} from '../../../src/app/utils/SecretResolver';

declare const window: any;

@Injectable({providedIn: 'root'})
export class SshElectronService {
  private ipc = window.electronAPI;

  constructor(
    private secretStorage: SecretStorageService,
    private tabService: TabService,
    private notification: NotificationService,
  ) {
    this.initListeners();
  }

  private initListeners() {
    if (!this.ipc) return;

    this.ipc.on('error', (event: any, data: any) => {
      if (data.category === 'ssh') {
        this.tabService.removeById(data.id);
      }
    });

    this.ipc.on('session.disconnect.terminal.ssh', (event: any, data: any) => {
      if (data.error) {
        this.notification.error('SSH Disconnected, you can try reconnect later');
      }
      this.tabService.disconnected(data.id);
    });
  }

  openSSHTerminalSession(session: Session) {
    if (!this.ipc || !session.profile || !session.profile.sshProfile) {
      return;
    }

    const sshConfig: any = {
      readyTimeout: 30000,
      keepaliveInterval: 15000,
      keepaliveCountMax: 5,
    };

    const sshProfile = session.profile.sshProfile;
    sshConfig.host = sshProfile.host;
    sshConfig.port = sshProfile.port;

    if (!resolveSecretToConfig(sshConfig, sshProfile, this.secretStorage, (m) => console.log(m))) {
      return;
    }

    const data: {[key: string]: any} = {
      terminalId: session.id,
      config: sshConfig,
    };

    if (session.profile.proxyId) {
      data['proxyId'] = session.profile.proxyId;
    }
    if (sshProfile.initPath) {
      data['initPath'] = sshProfile.initPath;
    }
    if (sshProfile.initCmd) {
      data['initCmd'] = sshProfile.initCmd;
    }

    this.ipc.send('session.open.terminal.ssh', data);
  }

  closeSSHTerminalSession(session: Session) {
    if (this.ipc) {
      this.ipc.send('session.close.terminal.ssh', {terminalId: session.id});
    }
  }
}
