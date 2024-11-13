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
      this.ipc.send('create-local-terminal', { terminalId: id });
    }
  }

  onTerminalOutput(callback: (data: string) => void) {
    if (this.ipc) {
      this.ipc.on('terminal-output', (event, data) => callback(data));
    }
  }

  sendTerminalInput(id:number, input: string) {
    if (this.ipc) {
      this.ipc.send('terminal-input', { terminalId: id, input: input });
    }
  }
}
