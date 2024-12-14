import { Injectable } from '@angular/core';
// @ts-ignore
import {VncProfile} from '../domain/profile/VncProfile';
import {AuthType, SecretType} from '../domain/Secret';
import {SecretStorageService} from './secret-storage.service';
import {ElectronService} from './electron.service';
import {BehaviorSubject} from 'rxjs';


// we use websockifyPath to proxy to the vnc server
// then use noVnc to display it
@Injectable({
  providedIn: 'root',
})
export class VncService {

  private frameSubject = new BehaviorSubject<any>(null);
  private statusSubject = new BehaviorSubject<any>(null);

  frame$ = this.frameSubject.asObservable();
  status$ = this.statusSubject.asObservable();

  constructor(
    private secretStorage: SecretStorageService,
    private electronService: ElectronService,
  ) {

    this.electronService.initVncListener(this.frameSubject, this.statusSubject);

  }

  connect(id: string, vncProfile: VncProfile) {
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

    this.electronService.openVncSession(id, vncProfile.host, vncProfile.port, vncProfile.password);
  }

  disconnect(id: string) {
    this.electronService.closeVncSession(id);
  }
}
