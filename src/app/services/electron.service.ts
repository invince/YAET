import { Injectable } from '@angular/core';
import { IpcRenderer } from 'electron';
import {TabInstance} from '../domain/TabInstance';
import {CREATION_LOCAL_TERMINAL, TERMINAL_INPUT, TERMINAL_OUTPUT} from './electronConstant';
import {LOCAL_TERMINAL} from '../domain/TabType';
import {LocalTerminalProfile} from '../domain/LocalTerminalProfile';
import {Profile} from '../domain/Profile';

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
      if (tab.tabType == LOCAL_TERMINAL) {
        if (!tab.profile) {
          tab.profile = new Profile();
        }
        if (!tab.profile.localTerminal) {
          tab.profile.localTerminal = new LocalTerminalProfile();
        }
        let localProfile: LocalTerminalProfile = tab.profile.localTerminal;
        this.ipc.send(CREATION_LOCAL_TERMINAL, { terminalId: tab.id, terminalExec: localProfile.execPath });
      }
    }
  }

  sendTerminalInput(tab: TabInstance, input: string) {
    if (this.ipc) {
      this.ipc.send(TERMINAL_INPUT, { terminalId: tab.id, input: input });
    }
  }

  onTerminalOutput(callback: (data: string) => void) {
    if (this.ipc) {
      this.ipc.on(TERMINAL_OUTPUT, (event, data) => callback(data));
    }
  }

  onLoadedEvent(eventName: string, callback: (data: string) => void) {
    if (this.ipc) {
      this.ipc.on(eventName, (event, data) => callback(data));
    }
  }


}
