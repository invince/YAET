import {ElementRef, Injectable} from '@angular/core';
import {SpiceProfile} from '../domain/spice-profile';
import {AuthType, SecretType} from '../../../../src/app/domain/Secret';
import {ElectronRemoteDesktopService} from '../../../../src/app/services/electron/electron-remote-desktop.service';
import {LogService} from '../../../../src/app/services/log.service';
import {SecretStorageService} from '../../../../src/app/services/secret-storage.service';

@Injectable({
  providedIn: 'root',
})
export class SpiceService {
  spiceMap: Map<string, any> = new Map();

  constructor(
    private log: LogService,
    private secretStorage: SecretStorageService,
    private electron: ElectronRemoteDesktopService,
  ) {
  }

  async connect(id: string, spiceProfile: SpiceProfile, spiceContainer: ElementRef) {
    if (!spiceProfile) {
      throw new Error('Invalid SPICE profile');
    }

    let password = '';
    if (spiceProfile.authType == AuthType.SECRET) {
      let secret = this.secretStorage.findById(spiceProfile.secretId);
      if (!secret) {
        throw new Error('Invalid secret');
      }
      switch (secret.secretType) {
        case SecretType.LOGIN_PASSWORD:
        case SecretType.PASSWORD_ONLY:
          password = secret.password;
          break;
      }
    } else if (spiceProfile.authType == AuthType.LOGIN) {
      password = spiceProfile.password;
    }

    const websocketPort = await this.electron.openSpiceSession(
      id, spiceProfile.host, spiceProfile.port, spiceProfile.tls,
    );

    const { SpiceMainConn } = await import('spice-client');
    const spiceConn = new SpiceMainConn({
      uri: `ws://localhost:${websocketPort}`,
      password: password || undefined,
      screen_id: 'spice-screen',
      parent: spiceContainer.nativeElement,
      onerror: (err: Error) => {
        this.log.error('SPICE error: ' + err.message);
      },
    });

    this.spiceMap.set(id, spiceConn);
  }

  disconnect(id: string) {
    this.electron.closeSpiceSession(id);
    let sc = this.spiceMap.get(id);
    if (sc) {
      sc.stop();
      sc.cleanup();
    }
    this.spiceMap.delete(id);
  }
}
