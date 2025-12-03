import { Injectable } from '@angular/core';
import { AuthType, SecretType } from '../../domain/Secret';
import { FTPProfile } from '../../domain/profile/FTPProfile';
import { RemoteTerminalProfile } from '../../domain/profile/RemoteTerminalProfile';
import { SambaProfile } from '../../domain/profile/SambaProfile';
import { SecretStorageService } from '../secret-storage.service';
import { SESSION_FTP_REGISTER, SESSION_SAMBA_REGISTER, SESSION_SCP_REGISTER, } from './ElectronConstant';
import { AbstractElectronService } from './electron.service';


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
    if (sshProfile.authType == AuthType.LOGIN) {
      sshConfig.username = sshProfile.login;
      sshConfig.password = sshProfile.password;
    } else if (sshProfile.authType == AuthType.SECRET) {
      let secret = this.secretStorage.findById(sshProfile.secretId);
      if (!secret) {
        this.log({ level: 'error', message: "Invalid secret " + sshProfile.secretId });
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
    if (ftpProfile.authType == AuthType.LOGIN) {
      ftpConfig.user = ftpProfile.login;
      ftpConfig.password = ftpProfile.password;
    } else if (ftpProfile.authType == AuthType.SECRET) {
      let secret = this.secretStorage.findById(ftpProfile.secretId);
      if (!secret) {
        this.log({ level: 'error', message: "Invalid secret " + ftpProfile.secretId });
        return;
      }
      switch (secret.secretType) {
        case SecretType.LOGIN_PASSWORD: {
          ftpConfig.user = secret.login;
          ftpConfig.password = secret.password;
          break;
        }
        case SecretType.SSH_KEY: {
          ftpConfig.user = secret.login;
          ftpConfig.privateKey = secret.key.replace(/\\n/g, '\n');
          if (secret.passphrase) {
            ftpConfig.passphrase = secret.passphrase;
          }
          break;
        }
        case SecretType.PASSWORD_ONLY: {
          // todo
          break;
        }
      }
    }
    await this.ipc.invoke(SESSION_FTP_REGISTER, { id: id, config: ftpConfig, proxyId: proxyId });
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
    if (sambaProfile.authType == AuthType.LOGIN) {
      sambaConfig.username = sambaProfile.login;
      sambaConfig.password = sambaProfile.password;
    } else if (sambaProfile.authType == AuthType.SECRET) {
      let secret = this.secretStorage.findById(sambaProfile.secretId);
      if (!secret) {
        this.log({ level: 'error', message: "Invalid secret " + sambaProfile.secretId });
        return;
      }
      switch (secret.secretType) {
        case SecretType.LOGIN_PASSWORD: {
          sambaConfig.username = secret.login;
          sambaConfig.password = secret.password;
          break;
        }
      }
    }
    await this.ipc.invoke(SESSION_SAMBA_REGISTER, { id: id, config: sambaConfig, proxyId: proxyId });
  }
}
