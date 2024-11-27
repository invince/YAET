import {Injectable} from '@angular/core';
import {Secret} from '../domain/Secret';
import {ElectronService} from './electron.service';
import {SECRETS_LOADED} from './electronConstant';
import {MasterKeyService} from './master-key.service';

@Injectable({
  providedIn: 'root'
})
export class SecretService{

  private _secrets!: Secret[];

  private _loaded: boolean = false;

  constructor(
    private electron: ElectronService,
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
          this._secrets =  JSON.parse(decrypted);
          this._loaded = true;
        }
      }
    )
  }

  get isLoaded() {
    return this._loaded;
  }


  set secrets(value: Secret[]) {
    this._secrets = value;
  }
  get secrets(): Secret[] {
    if (!this._secrets) {
      // [TEST CODE]
      // let one = new Secret();
      // one.name = 'test';
      // one.isNew = false;
      // this._secrets = [new Secret(), one];
      this._secrets = [];
    }
    return this._secrets;
  }



  deleteLocal(secret: Secret) {
    if (!secret) {
      return;
    }
    if (!this.secrets) {
      this.secrets = [];
    }
    this.secrets = this.secrets.filter(one => one.id != secret.id);
  }

  async saveAll() {
    if (!this._secrets) {
      return;
    }
    for (let one of this._secrets) {
      one.isNew = false;
    }
    this.masterKeyService.encrypt(this._secrets).then(
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
