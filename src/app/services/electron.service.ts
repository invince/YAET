import {Injectable} from '@angular/core';
import {IpcRenderer} from 'electron';
import {TabInstance} from '../domain/TabInstance';
import {
  CLOUD_DOWNLOAD,
  CLOUD_RELOAD, CLOUD_SAVE, CLOUD_UPLOAD,
  CREATION_LOCAL_TERMINAL,
  CREATION_SSH_TERMINAL,
  DELETE_MASTERKEY,
  GET_MASTERKEY,
  PROFILES_RELOAD,
  PROFILES_SAVE,
  SAVE_MASTERKEY,
  SECRETS_RELOAD,
  SECRETS_SAVE,
  SETTINGS_RELOAD,
  SETTINGS_SAVE,
  TERMINAL_INPUT,
  TERMINAL_OUTPUT
} from './electronConstant';
import {LocalTerminalProfile} from '../domain/LocalTerminalProfile';
import {Profile, ProfileType} from '../domain/Profile';
import {MySettings} from '../domain/MySettings';
import {AuthType, SecretType} from '../domain/Secret';
import {SecretStorageService} from './secret-storage.service';
import {CloudSettings} from '../domain/CloudSettings';
import {CloudResponse} from '../domain/CloudResponse';

@Injectable({
  providedIn: 'root',
})
export class ElectronService {
  private ipc!: IpcRenderer;

  constructor(private secretStorage: SecretStorageService) {
    if (window.require) {
      this.ipc = window.require('electron').ipcRenderer;
    }
  }

  createTerminal(tab: TabInstance) {
    if (this.ipc) {
      switch (tab.tabType) {
        case ProfileType.LOCAL_TERMINAL: this.createLocalTerminal(tab); break;
        case ProfileType.SSH_TERMINAL: this.createSSHTerminal(tab); break;


      }
    }
  }

  private createLocalTerminal(tab: TabInstance) {
    if (!tab.profile) {
      tab.profile = new Profile();
    }
    if (!tab.profile.localTerminal) {
      tab.profile.localTerminal = new LocalTerminalProfile();
    }
    let localProfile: LocalTerminalProfile = tab.profile.localTerminal;
    this.ipc.send(CREATION_LOCAL_TERMINAL, {terminalId: tab.id, terminalExec: localProfile.execPath});
  }

  private createSSHTerminal(tab: TabInstance) {
    if (!tab.profile || !tab.profile.sshTerminalProfile) {
      console.error("Invalid configuration");
      return;
    }

    let sshConfig: any = {
      readyTimeout: 30000,           // Wait up to 30 seconds for the connection.
      keepaliveInterval: 15000,      // Send keepalive packets every 15 seconds.
      keepaliveCountMax: 5,          // Disconnect after 5 failed keepalive packets.
    };
    let sshProfile = tab.profile.sshTerminalProfile;
    sshConfig.host = sshProfile.host;
    sshConfig.port = sshProfile.port;
    if (sshProfile.authType == AuthType.LOGIN) {
      sshConfig.username = sshProfile.login;
      sshConfig.password = sshProfile.password;
    } else if (sshProfile.authType == AuthType.SECRET) {
      let secret = this.secretStorage.findById(sshProfile.secretId);
      if (!secret) {
        console.error("Invalid secret " + sshProfile.secretId);
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
          sshConfig.privateKey = secret.key;
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
    this.ipc.send(CREATION_SSH_TERMINAL, {terminalId: tab.id, config: sshConfig});
  }


  sendTerminalInput(tab: TabInstance, input: string) {
    if(this.ipc) {
      this.ipc.send(TERMINAL_INPUT, {terminalId: tab.id, input: input});
    }
  }

  onTerminalOutput(callback: (data: string) => void) {
    if(this.ipc) {
      this.ipc.on(TERMINAL_OUTPUT, (event, data) => callback(data));
    }
  }

  saveSetting(settings: MySettings) {
    if(this.ipc) {
      this.ipc.send(SETTINGS_SAVE, {data: settings});
    }
  }

  onLoadedEvent(eventName: string, callback: (data: string) => void) {
    if (this.ipc) {
      this.ipc.on(eventName, (event, data) => callback(data));
    }
  }


  reloadSettings() {
    if (this.ipc) {
      this.ipc.send(SETTINGS_RELOAD, {});
    }
  }

  async getPassword(service: string, account: string): Promise<string|undefined>  {
    if(this.ipc) {
      return await this.ipc.invoke(GET_MASTERKEY,  service, account);
    }
    return;
  }

  async setPassword(service: string, account: string, masterKey: string) {
    if (this.ipc) {
      await this.ipc.invoke(SAVE_MASTERKEY,  service, account, masterKey);
    }
  }

  async deletePassword(service: string, account: string) {
    if (this.ipc) {
      await this.ipc.invoke(DELETE_MASTERKEY,  service, account);
    }
  }

  async saveProfiles(encryptedProfiles: string) {
    if(this.ipc) {
      await this.ipc.send(PROFILES_SAVE, {data: encryptedProfiles});
    }
  }

  reloadProfiles() {
    if (this.ipc) {
      this.ipc.send(PROFILES_RELOAD, {});
    }
  }


  async saveSecrets(encryptedSecrets: string) {
    if (this.ipc) {
      await this.ipc.send(SECRETS_SAVE, {data: encryptedSecrets});
    }
  }

  reloadSecrets() {
    if (this.ipc) {
      this.ipc.send(SECRETS_RELOAD, {});
    }
  }


  async saveCloud(encrypted: string) {
    if(this.ipc) {
      await this.ipc.send(CLOUD_SAVE, {data: encrypted});
    }
  }

  reloadCloud() {
    if (this.ipc) {
      this.ipc.send(CLOUD_RELOAD, {});
    }
  }

  async downloadCloud(cloudSettings: CloudSettings):  Promise<CloudResponse | undefined>  {
    if (this.ipc) {

      let cloud = this.prepareCloudSettings(cloudSettings);
      if (!cloud) {
        console.error("Invalid Cloud Settings");
        return undefined;
      }

      return this.ipc.invoke(CLOUD_DOWNLOAD, {data: cloud});
    }
    return undefined;
  }

  async uploadCloud(cloudSettings: CloudSettings): Promise<CloudResponse | undefined> {
    if (this.ipc) {

      let cloud = this.prepareCloudSettings(cloudSettings);
      if (!cloud) {
        console.error("Invalid Cloud Settings");
        return undefined;
      }
      return  await this.ipc.invoke(CLOUD_UPLOAD, {data: cloud});
    }
    return undefined;
  }

  private prepareCloudSettings (cloudSettings: CloudSettings): CloudSettings | undefined {
    if (cloudSettings.authType == AuthType.SECRET) {
      let secret = this.secretStorage.findById(cloudSettings.secretId);
      if (!secret) {
        console.error("Invalid secret " + cloudSettings.secretId);
        return undefined;
      }
      switch (secret.secretType) {
        case SecretType.LOGIN_PASSWORD: {
          cloudSettings.login = secret.login;
          cloudSettings.password = secret.password;
          break;
        }
      }
    }
    return cloudSettings;

  }
}
