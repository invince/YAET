import {Injectable, OnDestroy} from '@angular/core';
import {Secret, Secrets, SecretType} from '../domain/Secret';
import {ElectronService} from './electron.service';
import {SECRETS_LOADED} from '../domain/electronConstant';
import {MasterKeyService} from './master-key.service';
import {SecretStorageService} from './secret-storage.service';
import {SettingStorageService} from './setting-storage.service';
import packageJson from '../../../package.json';
import {Subscription} from 'rxjs';
import {LogService} from './log.service';
import {Compatibility} from '../../main';
import {compareVersions} from '../utils/VersionUtils';
import {NotificationService} from './notification.service';


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
    private masterKeyService: MasterKeyService,
    private notification: NotificationService,
  ) {
    electron.onLoadedEvent(SECRETS_LOADED, data => {
      this.apply(data);
    });

    this.subscriptions.push(masterKeyService.updateEvent$.subscribe(event => {
      if(event === 'invalid') {
        this.secretStorage.data = new Secrets();
        this.saveAll();
        this.notification.info('Secrets cleared');
      } else {
        this.saveAll();
        this.notification.info('Secrets re-encrypted');
      }

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
                let msg = "Your application is not compatible with saved settings, please update your app. For instance, empty secrets applied";
                this.log.warn(msg);
                this.notification.info(msg);
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

  deleteOne(secretToDelete: Secret) {
    if (!secretToDelete) {
      return;
    }
    if (!this.secretStorage.data) {
      this.secretStorage.data = new Secrets();
    }
    if (!this.secretStorage.data.secrets) {
      this.secretStorage.data.secrets = [];
    }
    this.secretStorage.data.secrets  = this.secretStorage.data.secrets .filter(one => one.id != secretToDelete.id);
  }

  updateOne(secretToUpdate: Secret) {
    if (secretToUpdate) {
      if (!this.secretStorage.data) {
        this.secretStorage.data = new Secrets();
      }
      if (!this.secretStorage.data.secrets) {
        this.secretStorage.data.secrets = [];
      }
      let index = this.secretStorage.data.secrets.findIndex(one => one.id == secretToUpdate.id);
      if (index >= 0) {
        this.secretStorage.data.secrets[index] = secretToUpdate;
      } else {
        console.warn("Secret not found, we'll add new secret");
        this.secretStorage.data.secrets.push(secretToUpdate);
      }
    }
  }

  async saveAll(secrets: Secrets = this.secretStorage.data) {
    if (!secrets) {
      secrets = new Secrets();
    }
    secrets.version = packageJson.version;
    secrets.compatibleVersion = Compatibility.secrets;
    this.secretStorage.data = secrets;
    for (let one of this.secretStorage.data.secrets) {
      one.isNew = false;
      switch (one.secretType) {
        case SecretType.PASSWORD_ONLY:
          one.icon = 'password'; break;
        case SecretType.LOGIN_PASSWORD:
          one.icon = 'face'; break;
        case SecretType.SSH_KEY:
          one.icon = 'key'; break;
      }
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
