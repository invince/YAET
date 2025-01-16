import {Injectable} from '@angular/core';
import {
  ERROR,
  SESSION_OPEN_RDP,
  SESSION_OPEN_VNC,
  SESSION_DISCONNECT_VNC, CLIPBOARD_PASTE, TRIGGER_NATIVE_CLIPBOARD_PASTE,
} from '../../domain/electronConstant';
import { ProfileType} from '../../domain/profile/Profile';
import {TabService} from '../tab.service';
import {RdpProfile} from '../../domain/profile/RdpProfile';
import {AbstractElectronService} from './electron.service';


@Injectable({
  providedIn: 'root',
})
export class ElectronRemoteDesktopService extends AbstractElectronService {

  private clipboardCallbackMap: Map<ProfileType, (id: string, text: string)=> boolean> = new Map();

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

  openRdpSession(rdpProfile: RdpProfile) {
    // hostname: string, options: { fullscreen?: boolean; admin?: boolean } = {}
    const hostname = rdpProfile.host;
    let options = {fullscreen: rdpProfile.fullScreen, admin: rdpProfile.asAdmin};
    if (this.ipc) {
      this.ipc.send(SESSION_OPEN_RDP, { hostname, options });
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


}
