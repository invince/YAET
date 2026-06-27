import {Injectable} from '@angular/core';

import {FTPProfile} from '../../domain/profile/FTPProfile';
import {RemoteTerminalProfile} from '../../domain/profile/RemoteTerminalProfile';
import {SambaProfile} from '../../domain/profile/SambaProfile';
import {SecretStorageService} from '../secret-storage.service';
import {
  SESSION_FTP_REGISTER,
  SESSION_SAMBA_REGISTER,
  SESSION_SCP_REGISTER,
  SESSION_SFTP_REGISTER,
} from './ElectronConstant';
import {AbstractElectronService} from './electron.service';
import {resolveSecretToConfig} from '../../utils/SecretResolver';


@Injectable({
  providedIn: 'root',
})
export class ElectronFileExplorerService extends AbstractElectronService {


  constructor(
    private secretStorage: SecretStorageService,
  ) {
    super();
  }

  async registerScpSession(id: string, sshProfile: RemoteTerminalProfile, proxyId?: string) {
    if (!id || !sshProfile) {
      this.log({ level: 'error', message: "Invalid configuration" });
      return;
    }
    let sshConfig: any = {
      readyTimeout: 30000,           // Wait up to 30 seconds for the connection.
      keepaliveInterval: 15000,      // Send keepalive packets every 15 seconds.
      keepaliveCountMax: 5,          // Disconnect after 5 failed keepalive packets.
    };

    sshConfig.host = sshProfile.host;
    sshConfig.port = sshProfile.port;
    if (!resolveSecretToConfig(sshConfig, sshProfile, this.secretStorage, m => this.log(m))) {
      return;
    }
    await this.ipc.invoke(SESSION_SCP_REGISTER, { id: id, config: sshConfig, proxyId: proxyId });
  }


  async registerFtpSession(id: string, ftpProfile: FTPProfile, proxyId?: string) {
    if (!id || !ftpProfile) {
      this.log({ level: 'error', message: "Invalid configuration" });
      return;
    }
    let ftpConfig: any = {
    };

    ftpConfig.host = ftpProfile.host;
    ftpConfig.port = ftpProfile.port;
    ftpConfig.secured = ftpProfile.secured;
    if (!resolveSecretToConfig(ftpConfig, ftpProfile, this.secretStorage, m => this.log(m), {username: 'user'})) {
      return;
    }
    await this.ipc.invoke(SESSION_FTP_REGISTER, { id: id, config: ftpConfig, proxyId: proxyId });
  }


  async registerSftpSession(id: string, sshProfile: RemoteTerminalProfile, proxyId?: string) {
    if (!id || !sshProfile) {
      this.log({ level: 'error', message: "Invalid configuration" });
      return;
    }
    let sshConfig: any = {
      readyTimeout: 30000,
      keepaliveInterval: 15000,
      keepaliveCountMax: 5,
    };

    sshConfig.host = sshProfile.host;
    sshConfig.port = sshProfile.port;
    if (!resolveSecretToConfig(sshConfig, sshProfile, this.secretStorage, m => this.log(m))) {
      return;
    }
    await this.ipc.invoke(SESSION_SFTP_REGISTER, { id: id, config: sshConfig, proxyId: proxyId });
  }

  async registerSambaSession(id: string, sambaProfile: SambaProfile, proxyId?: string) {
    if (!id || !sambaProfile) {
      this.log({ level: 'error', message: "Invalid configuration" });
      return;
    }
    let sambaConfig: any = {
    };

    sambaConfig.share = sambaProfile.share;
    sambaConfig.port = sambaProfile.port;
    sambaConfig.domain = sambaProfile.domain;
    if (!resolveSecretToConfig(sambaConfig, sambaProfile, this.secretStorage, m => this.log(m))) {
      return;
    }
    await this.ipc.invoke(SESSION_SAMBA_REGISTER, { id: id, config: sambaConfig, proxyId: proxyId });
  }
}
