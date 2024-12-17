import {Injectable} from '@angular/core';
import {IpcRenderer } from 'electron';
import {TabInstance} from '../domain/TabInstance';
import {
  CLOUD_DOWNLOAD,
  CLOUD_RELOAD,
  CLOUD_SAVE,
  CLOUD_UPLOAD,
  SESSION_OPEN_LOCAL_TERMINAL,
  SESSION_OPEN_SSH_TERMINAL,
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
  SESSION_DISCONNECT_SSH,
  TERMINAL_INPUT,
  TERMINAL_OUTPUT,
  SESSION_OPEN_RDP,
  SESSION_OPEN_VNC,
  SESSION_DISCONNECT_VNC,
  CLIPBOARD_PASTE,
  TRIGGER_NATIVE_CLIPBOARD_PASTE, SESSION_OPEN_CUSTOM
} from '../domain/electronConstant';
import {LocalTerminalProfile} from '../domain/profile/LocalTerminalProfile';
import {Profile, ProfileType} from '../domain/profile/Profile';
import {MySettings} from '../domain/setting/MySettings';
import {AuthType, SecretType} from '../domain/Secret';
import {SecretStorageService} from './secret-storage.service';
import {CloudSettings} from '../domain/setting/CloudSettings';
import {CloudResponse} from '../domain/setting/CloudResponse';
import {MatSnackBar} from '@angular/material/snack-bar';
import {TabService} from './tab.service';
import {RdpProfile} from '../domain/profile/RdpProfile';
import {BehaviorSubject} from 'rxjs';
import {CustomProfile} from '../domain/profile/CustomProfile';


@Injectable({
  providedIn: 'root',
})
export class ElectronService {
  private readonly ipc!: IpcRenderer;

  private clipboardCallbackMap: Map<ProfileType, (id: string, text: string)=> boolean> = new Map();

  constructor(
    private secretStorage: SecretStorageService,
    private _snackBar: MatSnackBar,

    private tabService: TabService,
  ) {
    if (window.require) {
      this.ipc = window.require('electron').ipcRenderer;


      this.initCommonListener();
      this.initTerminalListener();
      this.initVncListener();
      this.initClipboardListener();
    }
  }

//#region "Common"
  onLoadedEvent(eventName: string, callback: (data: string) => void) {
    if (this.ipc) {
      this.ipc.on(eventName, (event, data) => callback(data));
    }
  }
  private initCommonListener() {
    this.ipc.on(ERROR, (event, data) => {
      console.error('Error:', data);
      this._snackBar.open('ERROR: ' + data.error,'ok', {
        duration: 3000,
        panelClass: [ 'error-snackbar']
      });
      return;
    });

  }

  private initClipboardListener() {
    if(this.ipc) {
      this.ipc.on(CLIPBOARD_PASTE, (event, data) => {
        let used = false;
        let tabSelected = this.tabService.getSelectedTab();
        if (tabSelected && [ProfileType.VNC_REMOTE_DESKTOP].includes(tabSelected.tabType)) {
          let callback = this.clipboardCallbackMap.get(tabSelected.tabType);
          if (callback && callback(tabSelected.id, data)) {
            used = true;
          }
        }

        if (!used) {
          this.ipc.send(TRIGGER_NATIVE_CLIPBOARD_PASTE, {data} );
        }
      });
    }
  }


  public subscribeClipboard (profileType: ProfileType, callback : (id: string, text: string)=> boolean) {
    this.clipboardCallbackMap.set(profileType, callback);
  }
//#endregion "Common"

//#region "Sessions"
  private initTerminalListener() {
    this.ipc.on(ERROR, (event, data) => {
      if (data.category == 'ssh') {
        this.tabService.removeById(data.id);
      }
      return;
    });

    this.ipc.on(SESSION_DISCONNECT_SSH, (event, data) => {
      console.log('SSH Disconnected:', data.id);
      this._snackBar.open('SSH Disconnected, you can try reconnect later','ok', {
        duration: 3000,
        panelClass: [ 'error-snackbar']
      });
      this.tabService.disconnected(data.id);
      // Handle disconnection logic
    });
  }

  openTerminalSession(tab: TabInstance) {
    if (this.ipc) {
      switch (tab.tabType) {
        case ProfileType.LOCAL_TERMINAL: this.openLocalTerminalSession(tab); break;
        case ProfileType.SSH_TERMINAL: this.openSSHTerminalSession(tab); break;


      }
    }
  }

  private openLocalTerminalSession(tab: TabInstance) {
    if (!tab.profile) {
      tab.profile = new Profile();
    }
    if (!tab.profile.localTerminal) {
      tab.profile.localTerminal = new LocalTerminalProfile();
    }
    let localProfile: LocalTerminalProfile = tab.profile.localTerminal;
    this.ipc.send(SESSION_OPEN_LOCAL_TERMINAL, {terminalId: tab.id, terminalExec: localProfile.execPath});
    this.tabService.connected(tab.id);
  }

  private openSSHTerminalSession(tab: TabInstance) {
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
    this.ipc.send(SESSION_OPEN_SSH_TERMINAL, {terminalId: tab.id, config: sshConfig});
    this.tabService.connected(tab.id);
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

  openRdpSession(rdpProfile: RdpProfile) {
    // hostname: string, options: { fullscreen?: boolean; admin?: boolean } = {}
    const hostname = rdpProfile.host;
    let options = {fullscreen: rdpProfile.fullScreen, admin: rdpProfile.asAdmin};
    if (this.ipc) {
      this.ipc.send(SESSION_OPEN_RDP, { hostname, options });
    }
  }

  openCustomSession(customProfile: CustomProfile) {
    if (this.ipc) {
      this.ipc.send(SESSION_OPEN_CUSTOM, { command: customProfile.execPath });
    }
  }

  initVncListener() {
    this.ipc.on(ERROR, (event, data) => {
      if (data.category == 'vnc') {
        this.tabService.removeById(data.id);
      }
      return;
    });
  }

  async openVncSession(id: string, host: string, port: number) {
    if (this.ipc) {
      return this.ipc.invoke(SESSION_OPEN_VNC, { id: id, host: host, port: port });
    }
    return;
  }


  closeVncSession(id: string) {
    if (this.ipc) {
      this.ipc.send(SESSION_DISCONNECT_VNC, { id: id});
    }
  }


//#endregion "Sessions"


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

//#endregion "Cloud"



}

export class TermOutput {
  id!: string;
  data!: string
}
