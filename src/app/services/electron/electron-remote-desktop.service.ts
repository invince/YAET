import {Injectable} from '@angular/core';
import {
  CLIPBOARD_PASTE,
  ERROR,
  SESSION_DISCONNECT_RDP,
  SESSION_DISCONNECT_VNC,
  SESSION_OPEN_RDP_WASM,
  SESSION_OPEN_VNC,
  TRIGGER_NATIVE_CLIPBOARD_PASTE,
} from './ElectronConstant';
import {TabService} from '../tab.service';
import {AbstractElectronService} from './electron.service';


@Injectable({
  providedIn: 'root',
})
export class ElectronRemoteDesktopService extends AbstractElectronService {

  constructor(
    private tabService: TabService,
  ) {
    super();
    this.initVncListener();
    this.initClipboardListener();
  }

  private initClipboardListener() {
    if(this.ipc) {
      this.ipc.on(CLIPBOARD_PASTE, (event, data) => {
        this.ipc.send(TRIGGER_NATIVE_CLIPBOARD_PASTE, {data} );
      });
    }
  }

  initVncListener() {
    this.ipc.on(ERROR, (event, data) => {
      if (data.category === 'vnc') {
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

  async openRdpEmbedded(id: string, host: string, port: number): Promise<number | undefined> {
    if (this.ipc) {
      return this.ipc.invoke(SESSION_OPEN_RDP_WASM, { id, host, port });
    }
    return;
  }

  closeRdpSession(id: string) {
    if (this.ipc) {
      this.ipc.send(SESSION_DISCONNECT_RDP, { id });
    }
  }
}
