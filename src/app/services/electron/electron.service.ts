import {MySettings} from '../../domain/setting/MySettings';
import {Injectable} from '@angular/core';
import {CloudSettings} from '../../domain/setting/CloudSettings';
import {CloudResponse} from '../../domain/setting/CloudResponse';
import {SecretStorageService} from '../secret-storage.service';
import {Log} from '../../domain/Log';
import {
  ACP_FETCH_MODELS,
  ACP_SEND,
  AI_FETCH_MODELS,
  AI_SEND_CHAT,
  AI_SEND_WITH_TOOLS,
  AI_TOOL_PROGRESS,
  CHECK_FOR_UPDATES,
  CLOUD_DOWNLOAD,
  CLOUD_RELOAD,
  CLOUD_SAVE,
  CLOUD_UPLOAD,
  DELETE_MASTERKEY,
  ERROR,
  GET_MASTERKEY,
  LOG,
  MASTER_KEY_CHANGED,
  OPEN_URL,
  PROFILES_RELOAD,
  PROFILES_SAVE,
  PROXIES_RELOAD,
  PROXIES_SAVE,
  SAVE_MASTERKEY,
  SECRETS_RELOAD,
  SECRETS_SAVE,
  SETTINGS_GET,
  SETTINGS_RELOAD,
  SETTINGS_SAVE,
} from './ElectronConstant';
import {resolveLoginPassword} from '../../utils/SecretResolver';
import {NotificationService} from '../notification.service';
import {TabService} from '../tab.service';

interface ElectronAPI {
  send(channel: string, data?: any): void;
  invoke(channel: string, data?: any): Promise<any>;
  on(channel: string, callback: (...args: any[]) => void): void;
  removeAllListeners(channel: string): void;
}


export class AbstractElectronService {

  protected readonly ipc!: ElectronAPI;

  constructor() {
    if ((window as any).electronAPI) {
      this.ipc = (window as any).electronAPI;
    }
  }

  log(log: Log) {
    if (this.ipc) {
      this.ipc.send(LOG, log);
    }
  }

  openUrl(url: string) {
    if (this.ipc) {
      this.ipc.send(OPEN_URL, { url: url });
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
      this.log({ level: 'error:', message: data });
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
    if (this.ipc) {
      this.ipc.send(SETTINGS_SAVE, { data: settings });
    }
  }

  reloadSettings() {
    if (this.ipc) {
      this.ipc.send(SETTINGS_RELOAD, {});
    }
  }

  async getSettings(): Promise<any> {
    if (this.ipc) {
      return await this.ipc.invoke(SETTINGS_GET);
    }
    return undefined;
  }

  checkForUpdates() {
    if (this.ipc) {
      this.ipc.send(CHECK_FOR_UPDATES, {});
    }
  }

  async sendAcpChat(command: string, args: string, model: string, messages: any[]): Promise<string> {
    if (this.ipc) {
      return await this.ipc.invoke(ACP_SEND, { command, args, model, messages });
    }
    throw new Error('Electron IPC not available');
  }

  async fetchAiModels(apiUrl: string, token: string): Promise<string[]> {
    if (this.ipc) {
      return await this.ipc.invoke(AI_FETCH_MODELS, { apiUrl, token });
    }
    throw new Error('Electron IPC not available');
  }

  async fetchAcpModels(command: string, args: string): Promise<string[]> {
    if (this.ipc) {
      return await this.ipc.invoke(ACP_FETCH_MODELS, { command, args });
    }
    throw new Error('Electron IPC not available');
  }

  async sendAiChat(apiUrl: string, token: string, model: string, messages: any[]): Promise<any> {
    if (this.ipc) {
      return await this.ipc.invoke(AI_SEND_CHAT, { apiUrl, token, model, messages });
    }
    throw new Error('Electron IPC not available');
  }

  async sendAiWithTools(apiUrl: string, token: string, model: string, messages: any[]): Promise<any> {
    if (this.ipc) {
      return await this.ipc.invoke(AI_SEND_WITH_TOOLS, { apiUrl, token, model, messages });
    }
    throw new Error('Electron IPC not available');
  }
  //#endregion "Settings"



  //#region "Profiles"
  async saveProfiles(encryptedProfiles: string) {
    if (this.ipc) {
      await this.ipc.send(PROFILES_SAVE, { data: encryptedProfiles });
    }
  }

  reloadProfiles() {
    if (this.ipc) {
      this.ipc.send(PROFILES_RELOAD, {});
    }
  }

  //#endregion "Profiles"


  //#region "Secrets"
  async getPassword(): Promise<string | undefined> {
    if (this.ipc) {
      return await this.ipc.invoke(GET_MASTERKEY);
    }
    return;
  }

  async setPassword(masterKey: string) {
    if (this.ipc) {
      await this.ipc.invoke(SAVE_MASTERKEY, masterKey);
    }
  }

  async deletePassword() {
    if (this.ipc) {
      await this.ipc.invoke(DELETE_MASTERKEY);
    }
  }

  onMasterKeyChanged(callback: () => void): () => void {
    if (this.ipc) {
      const handler = () => callback();
      this.ipc.on(MASTER_KEY_CHANGED, handler);
      return () => this.ipc.removeAllListeners(MASTER_KEY_CHANGED);
    }
    return () => {};
  }

  async saveSecrets(encryptedSecrets: string) {
    if (this.ipc) {
      await this.ipc.send(SECRETS_SAVE, { data: encryptedSecrets });
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
    if (this.ipc) {
      await this.ipc.send(CLOUD_SAVE, { data: encrypted });
    }
  }

  reloadCloud() {
    if (this.ipc) {
      this.ipc.send(CLOUD_RELOAD, {});
    }
  }

  async downloadCloud(cloudSettings: CloudSettings): Promise<CloudResponse | undefined> {
    if (this.ipc) {

      let cloud = this.prepareCloudSettings(cloudSettings);
      if (!cloud) {
        this.log({ level: 'error', message: "Invalid Cloud Settings" });
        return undefined;
      }

      return this.ipc.invoke(CLOUD_DOWNLOAD, { data: cloud });
    }
    return undefined;
  }

  async uploadCloud(cloudSettings: CloudSettings): Promise<CloudResponse | undefined> {
    if (this.ipc) {

      let cloud = this.prepareCloudSettings(cloudSettings);
      if (!cloud) {
        this.log({ level: 'error', message: "Invalid Cloud Settings" });
        return undefined;
      }
      return await this.ipc.invoke(CLOUD_UPLOAD, { data: cloud });
    }
    return undefined;
  }

  private prepareCloudSettings(cloudSettings: CloudSettings): CloudSettings | undefined {
    if (!resolveLoginPassword(cloudSettings, cloudSettings, this.secretStorage, m => this.log(m))) {
      return undefined;
    }
    return cloudSettings;

  }

  //#endregion "Cloud"

  //#region "Proxies"
  async saveProxies(proxies: any) {
    if (this.ipc) {
      await this.ipc.send(PROXIES_SAVE, { data: proxies });
    }
  }

  reloadProxies() {
    if (this.ipc) {
      this.ipc.send(PROXIES_RELOAD, {});
    }
  }
  //#endregion "Proxies"

  //#region "ACP"
  onAcpChunk(callback: (data: { chunk: string }) => void) {
    if (this.ipc) {
      this.ipc.on('acp.chunk', (event: any, data: any) => callback(data));
    }
  }

  removeAcpChunkListeners() {
    if (this.ipc) {
      this.ipc.removeAllListeners('acp.chunk');
    }
  }
  //#endregion "ACP"

  //#region "AI Tool Progress"
  onToolProgress(callback: (data: any) => void) {
    if (this.ipc) {
      this.ipc.on(AI_TOOL_PROGRESS, (event: any, data: any) => callback(data));
    }
  }

  removeToolProgressListeners() {
    if (this.ipc) {
      this.ipc.removeAllListeners(AI_TOOL_PROGRESS);
    }
  }
  //#endregion "AI Tool Progress"
}

export class TermOutput {
  id!: string;
  data!: string
}
