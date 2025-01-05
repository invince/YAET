import {Injectable, OnDestroy} from '@angular/core';
import {Secret, Secrets} from '../domain/Secret';
import {ElectronService} from './electron.service';
import {SECRETS_LOADED} from '../domain/electronConstant';
import {MasterKeyService} from './master-key.service';
import {SecretStorageService} from './secret-storage.service';
import {SettingStorageService} from './setting-storage.service';
import packageJson from '../../../package.json';
import {Subscription} from 'rxjs';
import {LogService} from './log.service';
import {Compatibility} from '../../main';
import {compareVersions} from '../utils/Utils';


@Injectable({
  providedIn: 'root'
})
export class SecretService implements OnDestroy{

  static CLOUD_OPTION = 'Secret';
  private _loaded: boolean = false;
  private subscriptions: Subscription[] =[];

  constructor(
    private log: LogService,
    private electron: ElectronService,

    private secretStorage: SecretStorageService,
    private settingStorage: SettingStorageService,
    private masterKeyService: MasterKeyService
  ) {
    electron.onLoadedEvent(SECRETS_LOADED, data => {
      this.apply(data);
    });

    this.subscriptions.push(masterKeyService.masterkeyUpdateEvent$.subscribe(one => {
      this.save();
    }));
  }

  apply(data: any) {
    if (!data) {
      this._loaded = true; // this means you don't have secret yet
      return;
    }
    this.masterKeyService.decrypt2String(data).then(
      decrypted => {
        if (decrypted) {
          let dataObj = JSON.parse(decrypted);
          if (dataObj) {
            if (dataObj.compatibleVersion) {
              if (compareVersions(dataObj.compatibleVersion, packageJson.version) > 0) {
                this.log.warn("Your application is not compatible with saved settings, please update your app. For instance, empty secrets applied");
                dataObj = new Secrets();
              }
            }
          }
          this.secretStorage.data =  dataObj;
          this._loaded = true;
        }
      }
    )
  }

  get isLoaded() {
    return this._loaded;
  }


  async save(secrets: Secrets = this.secretStorage.data) {
    if (!secrets) {
      secrets = new Secrets();
    }
    this.secretStorage.data = secrets;
    this.secretStorage.data.version = packageJson.version;
    this.secretStorage.data.compatibleVersion = Compatibility.secrets;
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

  displaySecretOptionName(secret: Secret) {
    let label = '';
    let LIMIT = this.settingStorage.settings?.ui?.secretLabelLengthInDropDown || 8;
    if (secret && secret.name) {
      label = secret.name;
      if (secret.name.length > LIMIT) {
        label = label.slice(0, LIMIT) + '...';
      }
    }
    if (secret && secret.login) {
      let loginPart = '-' + secret.login;
      if (loginPart.length > LIMIT) {
        loginPart = loginPart.slice(0, LIMIT) + '...';
      }
      label += loginPart + '/***';
    }
    return label;
  }

  ngOnDestroy(): void {
    if (this.subscriptions) {
      this.subscriptions.forEach(one => one.unsubscribe());
    }
  }

}
