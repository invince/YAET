import {Injectable} from '@angular/core';
import {IpcRenderer } from 'electron';
import {
  CLOUD_DOWNLOAD,
  CLOUD_RELOAD,
  CLOUD_SAVE,
  DELETE_MASTERKEY,
  ERROR,
  GET_MASTERKEY,
  PROFILES_RELOAD,
  PROFILES_SAVE,
  SAVE_MASTERKEY,
  SECRETS_RELOAD,
  SECRETS_SAVE,
  SETTINGS_RELOAD,
  SETTINGS_SAVE,
  LOG, CLOUD_UPLOAD,
} from '../../domain/electronConstant';
import {ProfileType} from '../../domain/profile/Profile';
import {MySettings} from '../../domain/setting/MySettings';
import {AuthType, SecretType} from '../../domain/Secret';
import {SecretStorageService} from '../secret-storage.service';
import {CloudSettings} from '../../domain/setting/CloudSettings';
import {CloudResponse} from '../../domain/setting/CloudResponse';
import {TabService} from '../tab.service';
import {Log} from '../../domain/Log';
import {NotificationService} from '../notification.service';


export class AbstractElectronService {

  protected readonly ipc!: IpcRenderer;

  constructor() {
    if (window.require) {
      this.ipc = window.require('electron').ipcRenderer;
    }
  }

  log(log: Log) {
    if (this.ipc) {
      this.ipc.send(LOG, log);
    }
  }

}

@Injectable({
  providedIn: 'root',
})
export class ElectronService extends AbstractElectronService {

  constructor(
    private secretStorage: SecretStorageService,
    private notification: NotificationService,

    private tabService: TabService,
  ) {
    super();
    this.initCommonListener();
  }

//#region "Common"
  onLoadedEvent(eventName: string, callback: (data: string) => void) {
    if (this.ipc) {
      this.ipc.on(eventName, (event, data) => callback(data));
    }
  }
  private initCommonListener() {
    this.ipc.on(ERROR, (event, data) => {
      this.log({level: 'error:', message:  data});
      this.notification.error('ERROR: ' + data.error);
      if (data.category === 'winrm' && data.id) {
        this.tabService.connected(data.id);
      }
      return;
    });

  }
//#endregion "Common"

//#region "Settings"
  saveSetting(settings: MySettings) {
    if(this.ipc) {
      this.ipc.send(SETTINGS_SAVE, {data: settings});
    }
  }

  reloadSettings() {
    if (this.ipc) {
      this.ipc.send(SETTINGS_RELOAD, {});
    }
  }
//#endregion "Settings"



//#region "Profiles"
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

//#endregion "Profiles"


//#region "Secrets"
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
//#endregion "Secrets"




//#region "Cloud"
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
        this.log({level: 'error', message : "Invalid Cloud Settings"});
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
        this.log({level: 'error', message : "Invalid Cloud Settings"});
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
        this.log({level: 'error', message : "Invalid secret " + cloudSettings.secretId});
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

//#endregion "Cloud"



}

export class TermOutput {
  id!: string;
  data!: string
}
