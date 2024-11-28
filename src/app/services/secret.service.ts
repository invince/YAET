import {Injectable} from '@angular/core';
import {Secret} from '../domain/Secret';
import {ElectronService} from './electron.service';
import {SECRETS_LOADED} from './electronConstant';
import {MasterKeyService} from './master-key.service';
import {SecretStorageService} from './secret-storage.service';

@Injectable({
  providedIn: 'root'
})
export class SecretService{

  private _loaded: boolean = false;

  constructor(
    private electron: ElectronService,

    private secretStorage: SecretStorageService,
    private masterKeyService: MasterKeyService
  ) {
    electron.onLoadedEvent(SECRETS_LOADED, data => {
      this.apply(data);
    })
  }

  apply(data: any) {
    this.masterKeyService.decrypt2String(data).then(
      decrypted => {
        if (decrypted) {
          this.secretStorage.secrets =  JSON.parse(decrypted);
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
    if (!this.secretStorage.secrets) {
      this.secretStorage.secrets= [];
    }
    this.secretStorage.secrets = this.secretStorage.secrets.filter(one => one.id != secret.id);
  }

  async saveAll() {
    if (!this.secretStorage.secrets) {
      return;
    }
    for (let one of this.secretStorage.secrets) {
      one.isNew = false;
    }
    this.masterKeyService.encrypt(this.secretStorage.secrets).then(
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



}
