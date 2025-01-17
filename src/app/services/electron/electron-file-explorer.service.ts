import {Injectable} from '@angular/core';
import {
   SESSION_SCP_REGISTER, SESSION_FTP_REGISTER,
} from '../../domain/electronConstant';
import {AbstractElectronService} from './electron.service';
import { RemoteTerminalProfile } from '../../domain/profile/RemoteTerminalProfile';
import {SecretStorageService} from '../secret-storage.service';
import {AuthType, SecretType} from '../../domain/Secret';
import {FTPProfile} from '../../domain/profile/FTPProfile';


@Injectable({
  providedIn: 'root',
})
export class ElectronFileExplorerService extends AbstractElectronService {


  constructor(
    private secretStorage: SecretStorageService,
  ) {
    super();
  }

  async registerScpSession(id: string, sshProfile: RemoteTerminalProfile) {
    if (!id || !sshProfile) {
      this.log({level: 'error', message : "Invalid configuration"});
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
    await this.ipc.invoke(SESSION_SCP_REGISTER, {id: id, config: sshConfig});
  }


  async registerFtpSession(id: string, ftpProfile: FTPProfile) {
    if (!id || !ftpProfile) {
      this.log({level: 'error', message : "Invalid configuration"});
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
        this.log({level: 'error', message : "Invalid secret " + ftpProfile.secretId});
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
    await this.ipc.invoke(SESSION_FTP_REGISTER, {id: id, config: ftpConfig});
  }


}
