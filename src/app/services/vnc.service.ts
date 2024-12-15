import {ElementRef, Injectable} from '@angular/core';
// @ts-ignore
import {VncProfile} from '../domain/profile/VncProfile';
import {AuthType, SecretType} from '../domain/Secret';
import {SecretStorageService} from './secret-storage.service';
import {ElectronService} from './electron.service';
import RFB from '@novnc/novnc/lib/rfb';

// we use ws to proxy to the vnc server
// then use noVnc to display it
@Injectable({
  providedIn: 'root',
})
export class VncService {



  constructor(
    private secretStorage: SecretStorageService,
    private electronService: ElectronService,
  ) {

  }

  connect(id: string, vncProfile: VncProfile, vncCanvas: ElementRef) {
    if (!vncProfile) {
      return;
    }

    if (vncProfile.authType == AuthType.SECRET) {
      let secret = this.secretStorage.findById(vncProfile.secretId);
      if (!secret) {
        console.error("Invalid secret " + vncProfile.secretId);
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
          credentials: { password: vncProfile.password }
        });
        rfb.viewOnly = false; // Set to true if you want a read-only connection
        rfb.clipViewport = true;
      }
    );
  }

  disconnect(id: string) {
    this.electronService.closeVncSession(id);
  }
}
