import {ElementRef, Injectable} from '@angular/core';
// @ts-ignore
import {VncProfile} from '../domain/profile/VncProfile';
import {AuthType, SecretType} from '../domain/Secret';
import {SecretStorageService} from './secret-storage.service';
import {ElectronService} from './electron.service';
import RFB from '@novnc/novnc/lib/rfb';
import {Subject} from 'rxjs';
import {ProfileType} from '../domain/profile/Profile';
import {SettingStorageService} from './setting-storage.service';
import {LogService} from './log.service';


// we use ws to proxy to the vnc server
// then use noVnc to display it
@Injectable({
  providedIn: 'root',
})
export class VncService {
  readonly XK_Control_L= 0xffe3; // from keysym.js
  readonly XK_Shift_L= 0xffe1; // from keysym.js
  readonly   XK_V =  0x0056; // from keysym.js
  vncMap: Map<string, RFB> = new Map();

  private clipboardEventSubject = new Subject<string>();
  clipboardEvent$ = this.clipboardEventSubject.asObservable();

  constructor(
    private log: LogService,
    private settingStorage: SettingStorageService,
    private secretStorage: SecretStorageService,
    private electronService: ElectronService,
  ) {
    this.electronService.subscribeClipboard(ProfileType.VNC_REMOTE_DESKTOP, (id: string, text: string) => {
      if(this.vncMap) {
        let rfb = this.vncMap.get(id);
        if (rfb) {
          rfb.clipboardPasteFrom(text);
          if (this.settingStorage.settings?.remoteDesktop?.vncClipboardCompatibleMode) {
            rfb.sendKey(this.XK_Control_L, "ControlLeft", true);
            rfb.sendKey(this.XK_Shift_L, "ShiftLeft", true);
            rfb.sendKey(this.XK_V, "v");
            rfb.sendKey(this.XK_Shift_L, "ShiftLeft", false);
            rfb.sendKey(this.XK_Control_L, "ControlLeft", false);
          }
          return true;
        }
      }
      return false;
    });
  }

  async connect(id: string, vncProfile: VncProfile, vncCanvas: ElementRef) {
    return new Promise((resolve, reject) => {
      if (!vncProfile) {
        reject(new Error('Invalid vnc profile'));
        return;
      }

      if (vncProfile.authType == AuthType.SECRET) {
        let secret = this.secretStorage.findById(vncProfile.secretId);
        if (!secret) {
          this.log.error("Invalid secret " + vncProfile.secretId);
          reject(new Error('Invalid secret profile'));
          return;
        }
        switch (secret.secretType) {
          case SecretType.LOGIN_PASSWORD: {
            vncProfile.login = secret.login;
            vncProfile.password = secret.password;
            break;
          }
          case SecretType.PASSWORD_ONLY: {
            vncProfile.password = secret.password;
            break;
          }
        }
      }
      this.electronService.openVncSession(id, vncProfile.host, vncProfile.port).then(
        websocketPort => {
          const rfb = new RFB(vncCanvas.nativeElement, `ws://localhost:${websocketPort}`, {
            // @ts-ignore
            credentials: {password: vncProfile.password},
          });
          rfb.qualityLevel = this.settingStorage.settings.remoteDesktop?.vncQuality || 9;
          rfb.compressionLevel = this.settingStorage.settings.remoteDesktop?.vncCompressionLevel || 0;
          rfb.viewOnly = false; // Set to true if you want a read-only connection
          rfb.clipViewport = true; // Clip the remote session to the viewport
          rfb.scaleViewport = true; // Scale the remote desktop to fit the container
          rfb.resizeSession = true; // Resize the remote session to match the container
          // Handle container resizing
          window.addEventListener('resize', () => {
            rfb.scaleViewport = true;
          });

          rfb.addEventListener('clipboard', async (event: any) => {
            const serverClipboardText = event.detail.text;
            this.log.info('Received clipboard data:' + serverClipboardText);
            await navigator.clipboard.writeText(serverClipboardText); // Sync with browser clipboard
          });
          this.vncMap.set(id, rfb);

          resolve('ok');  // Successfully connected
        }
      );
    });
  }

  disconnect(id: string) {
    this.electronService.closeVncSession(id);
    let rfb = this.vncMap.get(id);
    rfb?.disconnect();
    this.vncMap.delete(id);
  }
}
