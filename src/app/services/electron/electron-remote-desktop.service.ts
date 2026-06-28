import {Injectable} from '@angular/core';
import {
  CLIPBOARD_PASTE,
  ERROR,
  SESSION_DISCONNECT_SPICE,
  SESSION_DISCONNECT_VNC,
  SESSION_OPEN_SPICE,
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
      if (data.category == 'vnc' || data.category == 'spice') {
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

  async openSpiceSession(id: string, host: string, port: number, tls?: boolean) {
    if (this.ipc) {
      return this.ipc.invoke(SESSION_OPEN_SPICE, { id, host, port, tls });
    }
    return;
  }

  closeSpiceSession(id: string) {
    if (this.ipc) {
      this.ipc.send(SESSION_DISCONNECT_SPICE, { id: id});
    }
  }


}
