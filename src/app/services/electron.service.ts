import {Injectable} from '@angular/core';
import {IpcRenderer } from 'electron';
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
  TRIGGER_NATIVE_CLIPBOARD_PASTE,
  SESSION_OPEN_CUSTOM,
  SESSION_SCP_REGISTER, SESSION_CLOSE_LOCAL_TERMINAL, SESSION_CLOSE_SSH_TERMINAL, LOG, PROXY
} from '../domain/electronConstant';
import {LocalTerminalProfile} from '../domain/profile/LocalTerminalProfile';
import {Profile, ProfileType} from '../domain/profile/Profile';
import {MySettings} from '../domain/setting/MySettings';
import {AuthType, SecretType} from '../domain/Secret';
import {SecretStorageService} from './secret-storage.service';
import {CloudSettings} from '../domain/setting/CloudSettings';
import {CloudResponse} from '../domain/setting/CloudResponse';
import {TabService} from './tab.service';
import {RdpProfile} from '../domain/profile/RdpProfile';
import {CustomProfile} from '../domain/profile/CustomProfile';
import {SSHProfile} from '../domain/profile/SSHProfile';
import {Session} from '../domain/session/Session';
import {Log} from '../domain/Log';
import {NotificationService} from './notification.service';
import {GeneralSettings} from '../domain/setting/GeneralSettings';


@Injectable({
  providedIn: 'root',
})
export class ElectronService {
  private readonly ipc!: IpcRenderer;

  private clipboardCallbackMap: Map<ProfileType, (id: string, text: string)=> boolean> = new Map();

  constructor(
    private secretStorage: SecretStorageService,
    private notification: NotificationService,

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
      this.log({level: 'error:', message:  data});
      this.notification.error('ERROR: ' + data.error);
      return;
    });

  }

  private initClipboardListener() {
    if(this.ipc) {
      this.ipc.on(CLIPBOARD_PASTE, (event, data) => {
        let used = false;
        let tabSelected = this.tabService.getSelectedTab();
        if (tabSelected && [ProfileType.VNC_REMOTE_DESKTOP].includes(tabSelected.session.profileType)) {
          let callback = this.clipboardCallbackMap.get(tabSelected.session.profileType);
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

  log(log: Log) {
    if (this.ipc) {
      this.ipc.send(LOG, log);
    }
  }

  updateProxy(general: GeneralSettings) {
    if (this.ipc) {
      let data: any = {};
      data.proxyUrl = general.proxyUrl;
      data.noProxy = general.proxyNoProxy;
      if (general.proxyAuthType == AuthType.SECRET) {
        let secret = this.secretStorage.findById(general.proxySecretId);
        if (!secret) {
          this.log({level: 'error', message : "Invalid secret " + general.proxySecretId});
          return undefined;
        }
        switch (secret.secretType) {
          case SecretType.LOGIN_PASSWORD: {
            data.login = secret.login;
            data.password = secret.password;
            break;
          }
        }
      }


      this.ipc.send(PROXY, data);
    }
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
      this.log({level: 'info', message: 'SSH Disconnected:' + data.id});
      this.notification.error('SSH Disconnected, you can try reconnect later');
      this.tabService.disconnected(data.id);
      // Handle disconnection logic
    });
  }

  openTerminalSession(session: Session) {
    if (this.ipc) {
      switch (session.profileType) {
        case ProfileType.LOCAL_TERMINAL: this.openLocalTerminalSession(session); break;
        case ProfileType.SSH_TERMINAL: this.openSSHTerminalSession(session); break;


      }
    }
  }
  closeTerminalSession(session: Session) {
    if (this.ipc) {
      switch (session.profileType) {
        case ProfileType.LOCAL_TERMINAL:
          this.ipc.send(SESSION_CLOSE_LOCAL_TERMINAL, {terminalId: session.id});
          break;
        case ProfileType.SSH_TERMINAL:
          this.ipc.send(SESSION_CLOSE_SSH_TERMINAL, {terminalId: session.id});
          break;
      }
    }
  }

  private openLocalTerminalSession(session: Session) {
    if (!session.profile) {
      session.profile = new Profile();
    }
    if (!session.profile.localTerminal) {
      session.profile.localTerminal = new LocalTerminalProfile();
    }
    let localProfile: LocalTerminalProfile = session.profile.localTerminal;
    this.ipc.send(SESSION_OPEN_LOCAL_TERMINAL, {terminalId: session.id, terminalExec: localProfile.execPath});
  }

  private openSSHTerminalSession(session: Session) {
    if (!session.profile || !session.profile.sshProfile) {
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

  async registerScpSession(id: string, sshProfile: SSHProfile) {
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
