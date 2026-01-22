import { Injectable, NgZone } from '@angular/core';
import { Observable, Subject } from 'rxjs';
import { AbstractElectronService } from './electron.service';
import {
    LOCAL_FILE_CHANGED,
    LOCAL_FILE_OPEN,
    LOCAL_FILE_READ,
    LOCAL_FILE_SAVE_TEMP,
    LOCAL_FILE_UNWATCH,
    LOCAL_FILE_WATCH
} from './ElectronConstant';

@Injectable({
  providedIn: 'root'
})
export class LocalFileWatcherService extends AbstractElectronService {

  private fileChangeSubject = new Subject<string>();

  constructor(private ngZone: NgZone) {
    super();
    this.initListener();
  }

  private initListener() {
    if (this.ipc) {
      this.ipc.on(LOCAL_FILE_CHANGED, (event, filePath) => {
        this.ngZone.run(() => {
          this.fileChangeSubject.next(filePath);
        });
      });
    }
  }

  get fileChanges$(): Observable<string> {
    return this.fileChangeSubject.asObservable();
  }

  async saveToTemp(filename: string, buffer: ArrayBuffer, folder?: string): Promise<{ success: boolean, path?: string, error?: string }> {
    if (this.ipc) {
      return await this.ipc.invoke(LOCAL_FILE_SAVE_TEMP, { filename, buffer, folder });
    }
    return { success: false, error: 'Electron IPC not available' };
  }

  async openFile(filePath: string): Promise<{ success: boolean, error?: string }> {
    if (this.ipc) {
      return await this.ipc.invoke(LOCAL_FILE_OPEN, filePath);
    }
    return { success: false, error: 'Electron IPC not available' };
  }

  async readFile(filePath: string): Promise<{ success: boolean, content?: string, error?: string }> {
    if (this.ipc) {
      return await this.ipc.invoke(LOCAL_FILE_READ, filePath);
    }
    return { success: false, error: 'Electron IPC not available' };
  }

  async watchFile(filePath: string): Promise<{ success: boolean, error?: string }> {
    if (this.ipc) {
      return await this.ipc.invoke(LOCAL_FILE_WATCH, filePath);
    }
    return { success: false, error: 'Electron IPC not available' };
  }

  async unwatchFile(filePath: string): Promise<{ success: boolean, error?: string }> {
    if (this.ipc) {
      return await this.ipc.invoke(LOCAL_FILE_UNWATCH, filePath);
    }
    return { success: false, error: 'Electron IPC not available' };
  }
}
