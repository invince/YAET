import {Injectable} from '@angular/core';
import {IpcRenderer} from 'electron';
import {TabInstance} from '../domain/TabInstance';
import {
  CREATION_LOCAL_TERMINAL, GET_PASSWORD, SAVE_PASSWORD,
  SETTINGS_RELOAD,
  SETTINGS_SAVE,
  TERMINAL_INPUT,
  TERMINAL_OUTPUT
} from './electronConstant';
import {LocalTerminalProfile} from '../domain/LocalTerminalProfile';
import {Profile, ProfileType} from '../domain/Profile';
import {MySettings} from '../domain/MySettings';

@Injectable({
  providedIn: 'root',
})
export class ElectronService {
  private ipc!: IpcRenderer;

  constructor() {
    if (window.require) {
      this.ipc = window.require('electron').ipcRenderer;
    }
  }

  createTerminal(tab: TabInstance) {
    if (this.ipc) {
      if (tab.tabType == ProfileType.LOCAL_TERMINAL) {
        if (!tab.profile) {
          tab.profile = new Profile();
        }
        if (!tab.profile.localTerminal) {
          tab.profile.localTerminal = new LocalTerminalProfile();
        }
        let localProfile: LocalTerminalProfile = tab.profile.localTerminal;
        this.ipc.send(CREATION_LOCAL_TERMINAL, {terminalId: tab.id, terminalExec: localProfile.execPath});
      }
    }
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
      return await this.ipc.invoke(GET_PASSWORD,  service, account);
    }
    return;
  }

  async setPassword(service: string, account: string, masterKey: string) {
    if (this.ipc) {
      await this.ipc.invoke(SAVE_PASSWORD,  service, account, masterKey);
    }
  }
}
