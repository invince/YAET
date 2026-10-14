import {Injectable} from '@angular/core';
import {Secret, Secrets, SecretType} from '../domain/Secret';
import {ElectronService} from './electron/electron.service';
import {SECRETS_LOADED} from './electron/ElectronConstant';
import {MasterKeyService} from './master-key.service';
import {SecretStorageService} from './secret-storage.service';
import {SettingStorageService} from './setting-storage.service';
import {Compatibility} from '../compatibility';
import {LogService} from './log.service';
import {NotificationService} from './notification.service';
import {EncryptedConfigStoreService} from './config-store.service';


@Injectable({
  providedIn: 'root'
})
export class SecretService extends EncryptedConfigStoreService<Secrets> {

  static CLOUD_OPTION = 'Secret';

  constructor(
    log: LogService,
    electron: ElectronService,
    private secretStorage: SecretStorageService,
    private settingStorage: SettingStorageService,
    masterKeyService: MasterKeyService,
    notification: NotificationService,
  ) {
    super(electron, log, notification, masterKeyService, {
      loadedEvent: SECRETS_LOADED,
      storeLabel: 'secrets',
      reload: () => electron.reloadSecrets(),
    });
  }

  // ---- EncryptedConfigStoreService contract ----

  protected override blank(): Secrets {
    return new Secrets();
  }

  protected override read(): Secrets {
    return this.secretStorage.data;
  }

  protected override write(data: Secrets): void {
    this.secretStorage.data = data;
  }

  protected override readonly compatVersion = Compatibility.secrets;
  protected override readonly incompatibleMessage =
    "Your application is not compatible with saved settings, please update your app. For instance, empty secrets applied";
  protected override readonly clearedMessage = 'Secrets cleared';

  protected override saveToMain(encrypted: string): unknown {
    return this.electron.saveSecrets(encrypted);
  }

  protected override preSave(secrets: Secrets): void {
    for (const one of secrets.secrets) {
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
  }

  // ---- Domain API (unchanged) ----

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
    await this.persist(secrets);
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

}
