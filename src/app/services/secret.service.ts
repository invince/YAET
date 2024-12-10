import {Injectable} from '@angular/core';
import {Secret} from '../domain/Secret';
import {ElectronService} from './electron.service';
import {SECRETS_LOADED} from './electronConstant';
import {MasterKeyService} from './master-key.service';
import {SecretStorageService} from './secret-storage.service';

@Injectable({
  providedIn: 'root'
})
export class SecretService {

  static CLOUD_OPTION = 'Secret';
  private _loaded: boolean = false;

  constructor(
    private electron: ElectronService,

    private secretStorage: SecretStorageService,
    private masterKeyService: MasterKeyService
  ) {
    electron.onLoadedEvent(SECRETS_LOADED, data => {
      this.apply(data);
    });
  }

  apply(data: any) {
    if (!data) {
      this._loaded = true; // this means you don't have secret yet
      return;
    }
    this.masterKeyService.decrypt2String(data).then(
      decrypted => {
        if (decrypted) {
          this.secretStorage.data =  JSON.parse(decrypted);
          this._loaded = true;
        }
      }
    )
  }

  get isLoaded() {
    return this._loaded;
  }
  deleteLocal(secret: Secret) {
    if (!secret) {
      return;
    }
    if (!this.secretStorage.data.secrets) {
      this.secretStorage.data.secrets= [];
    }
    this.secretStorage.data.secrets = this.secretStorage.data.secrets.filter(one => one.id != secret.id);
  }

  async saveAll() {
    if (!this.secretStorage.data.secrets) {
      return;
    }
    for (let one of this.secretStorage.data.secrets) {
      one.isNew = false;
    }

    this.secretStorage.data.revision = Date.now();

    this.masterKeyService.encrypt(this.secretStorage.data).then(
      encrypted => {
        if (encrypted) {
          this.electron.saveSecrets(encrypted);
        }
      }
    )
  }

  reload() {
    this._loaded = false;
    this.electron.reloadSecrets();
  }


  deleteNotSavedNewSecretInLocal() {
    this.secretStorage.data.secrets = this.secretStorage.data.secrets.filter(one => !one.isNew);
  }
}
