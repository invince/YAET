import {Injectable, OnDestroy} from '@angular/core';
import {Secret} from '../domain/Secret';
import {ElectronService} from './electron.service';
import {GET_MASTERKEY, SECRETS_LOADED} from './electronConstant';
import CryptoJS from 'crypto-js';

@Injectable({
  providedIn: 'root'
})
export class SecretService implements OnDestroy{

  private _secrets!: Secret[];

  private _loaded: boolean = false;
  private _masterKeyLoaded: boolean = false;

  private _hasMasterKey?: boolean;

  private readonly intervalId: NodeJS.Timeout;

  constructor(private electron: ElectronService) {
    electron.onLoadedEvent(SECRETS_LOADED, data => {
      this.apply(data);
    })

    this.refreshHasMasterKey();
    this.intervalId = setInterval(()=> this.refreshHasMasterKey(), 30 * 1000)
  }

  // This will be called when the service is destroyed
  ngOnDestroy(): void {
    clearInterval(this.intervalId); // Clean up resources
  }

  apply(data: any) {
    const service = 'io.github.invince.YAET';
    const account = 'ac13ba1ac2f841d19a9f73bd8c335086';
    this.electron.getPassword(service, account).then(
      masterKey => {
        if (masterKey) {
          const bytes = CryptoJS.AES.decrypt(data, masterKey);
          const decrypted = bytes.toString(CryptoJS.enc.Utf8);
          this._secrets =  JSON.parse(decrypted);
        } else {
          console.error("No master key defined");
          this._loaded = true;
        }
      }
    );
  }

  get isLoaded() {
    return this._loaded;
  }

  get isMasterKeyLoaded() {
    return this._masterKeyLoaded;
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

  deleteMasterKey() {
    const service = 'io.github.invince.YAET';
    const account = 'ac13ba1ac2f841d19a9f73bd8c335086';
    this.electron.deletePassword(service, account).then(r => {
      this.refreshHasMasterKey();
    });
  }

  get hasMasterKey() {
    return this._hasMasterKey;
  }

  async matchMasterKey(masterKey: string) : Promise<boolean> {
    const service = 'io.github.invince.YAET';
    const account = 'ac13ba1ac2f841d19a9f73bd8c335086';
    const key = await this.electron.getPassword(service, account);
    return masterKey === key;
  }

  saveMasterKey(masterKey: string) {
    const service = 'io.github.invince.YAET';
    const account = 'ac13ba1ac2f841d19a9f73bd8c335086';
    this.electron.setPassword(service, account, masterKey).then(r => {
      this.refreshHasMasterKey();
    });
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
    if (!this._secrets || this._secrets.length == 0) {
      return;
    }
    for (let one of this._secrets) {
      one.isNew = false;
    }
    const service = 'io.github.invince.YAET';
    const account = 'ac13ba1ac2f841d19a9f73bd8c335086';
    this.electron.getPassword(service, account).then(
      masterKey => {
        if (masterKey) {
          const json = JSON.stringify(this._secrets, null, 2);
          this.electron.saveSecrets(CryptoJS.AES.encrypt(json, masterKey).toString());
        } else {
          console.error("No master key defined");
        }
      }
    )
  }

  reload() {
    this._loaded = false;
    this.electron.reloadSecrets();
  }


  private refreshHasMasterKey() {
    const service = 'io.github.invince.YAET';
    const account = 'ac13ba1ac2f841d19a9f73bd8c335086';
    this.electron.getPassword(service, account).then(key => {
      if (key && key.length > 0) {
        this._hasMasterKey = true;
      } else {
        this._hasMasterKey = false;
      }
      this._masterKeyLoaded = true;
    });
  }
}
