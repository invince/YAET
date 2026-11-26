import {ElementRef, Injectable} from '@angular/core';
import RFB from '@novnc/novnc/lib/rfb';
import {Subject} from 'rxjs';
import {VncProfile} from '../domain/VncProfile';
import {AuthType, SecretType} from '../../../../src/app/domain/Secret';
import {ElectronRemoteDesktopService} from '../../../../src/app/services/electron/electron-remote-desktop.service';
import {LogService} from '../../../../src/app/services/log.service';
import {SecretStorageService} from '../../../../src/app/services/secret-storage.service';
import {SettingStorageService} from '../../../../src/app/services/setting-storage.service';
import {TabService} from '../../../../src/app/services/tab.service';

const XK_Control_L = 0xffe3;
const XK_v = 0x76;


// we use ws to proxy to the vnc server
// then use noVnc to display it
@Injectable({
  providedIn: 'root',
})
export class VncService {
  vncMap: Map<string, RFB> = new Map();
  private resizeHandlers: Map<string, () => void> = new Map();

  private clipboardEventSubject = new Subject<string>();
  clipboardEvent$ = this.clipboardEventSubject.asObservable();

  constructor(
    private log: LogService,
    private settingStorage: SettingStorageService,
    private secretStorage: SecretStorageService,
    private electron: ElectronRemoteDesktopService,
    private tabService: TabService,
  ) {
  }

  getRfb(id: string): RFB | undefined {
    return this.vncMap.get(id);
  }

  isConnected(id: string): boolean {
    return !!this.vncMap.get(id);
  }

  private isActive(id: string): boolean {
    return this.tabService.getSelectedTab()?.id === id;
  }

  /**
   * Push local text into the remote clipboard.
   * With `ctrlAlreadyDown` the Control key is already held remotely (the real
   * Ctrl keydown was forwarded by noVNC), so only V is sent afterwards.
   */
  private setRemoteClipboardAndPaste(id: string, text: string, ctrlAlreadyDown: boolean): boolean {
    const rfb = this.vncMap.get(id);
    if (!rfb) return false;
    try {
      rfb.clipboardPasteFrom(text);
      if (ctrlAlreadyDown) {
        rfb.sendKey(XK_v, 'KeyV', true);
        rfb.sendKey(XK_v, 'KeyV', false);
      } else {
        rfb.sendKey(XK_Control_L, 'ControlLeft', true);
        rfb.sendKey(XK_v, 'KeyV', true);
        rfb.sendKey(XK_v, 'KeyV', false);
        rfb.sendKey(XK_Control_L, 'ControlLeft', false);
      }
      return true;
    } catch (e) {
      this.log.warn('Failed to paste into VNC session: ' + e);
      return false;
    }
  }

  /** Read the local clipboard and paste it into the remote session. */
  async pasteFromLocalClipboard(id: string, ctrlAlreadyDown: boolean): Promise<boolean> {
    if (!this.vncMap.get(id)) return false;
    let text: string;
    try {
      text = await navigator.clipboard.readText();
    } catch (e) {
      this.log.warn('Failed to read local clipboard: ' + e);
      return false;
    }
    if (!text) return false;
    return this.setRemoteClipboardAndPaste(id, text, ctrlAlreadyDown);
  }

  /** Paste a known text (e.g. from a paste event) into the remote session. */
  pasteText(id: string, text: string): boolean {
    if (!text) return false;
    return this.setRemoteClipboardAndPaste(id, text, false);
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
      this.electron.openVncSession(id, vncProfile.host, vncProfile.port).then(
        websocketPort => {
          const rfb = new RFB(vncCanvas.nativeElement, `ws://localhost:${websocketPort}`, {
            credentials: { password: vncProfile.password },
          });
          rfb.qualityLevel = this.settingStorage.settings.remoteDesktop?.vncQuality || 7;
          rfb.compressionLevel = this.settingStorage.settings.remoteDesktop?.vncCompressionLevel || 6;
          rfb.viewOnly = false; // Set to true if you want a read-only connection
          rfb.clipViewport = true; // Clip the remote session to the viewport
          rfb.scaleViewport = true; // Scale the remote desktop to fit the container
          rfb.resizeSession = true; // Resize the remote session to match the container
          // Handle container resizing
          const onResize = () => { rfb.scaleViewport = true; };
          window.addEventListener('resize', onResize);
          this.resizeHandlers.set(id, onResize);

          rfb.addEventListener('clipboard', async (event: any) => {
            const serverClipboardText = event.detail?.text;
            if (!serverClipboardText) return;
            // Only mirror the clipboard of the visible session, so background
            // sessions cannot silently clobber the local clipboard.
            if (!this.isActive(id)) return;
            this.log.debug('Received clipboard data, syncing local clipboard');
            try {
              await navigator.clipboard.writeText(serverClipboardText);
            } catch (e) {
              this.log.warn('Failed to write local clipboard: ' + e);
            }
          });
          this.vncMap.set(id, rfb);

          resolve('ok');  // Successfully connected
        }
      );
    });
  }

  disconnect(id: string) {
    this.electron.closeVncSession(id);
    let rfb = this.vncMap.get(id);
    rfb?.disconnect();
    this.vncMap.delete(id);
    const onResize = this.resizeHandlers.get(id);
    if (onResize) {
      window.removeEventListener('resize', onResize);
      this.resizeHandlers.delete(id);
    }
  }
}
