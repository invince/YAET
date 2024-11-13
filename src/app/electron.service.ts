// electron.service.ts
import { Injectable } from '@angular/core';
import { IpcRenderer } from 'electron';

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

  createTerminal(id: number) {
    if (this.ipc) {
      this.ipc.send(id % 2 === 0 ? 'create-local-terminal' : 'create-ssh-terminal', {});
      this.ipc.on('terminal-output', (event, data) => {
        console.log(data);  // 数据输出到前端
      });
    }
  }
}
