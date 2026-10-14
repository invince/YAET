import {Injectable} from '@angular/core';
import {Compatibility} from '../compatibility';
import {CloudResponse} from '../domain/setting/CloudResponse';
import {CloudSettings} from '../domain/setting/CloudSettings';
import {ElectronService} from './electron/electron.service';
import {CLOUD_LOADED} from './electron/ElectronConstant';
import {LogService} from './log.service';
import {MasterKeyService} from './master-key.service';
import {NotificationService} from './notification.service';
import {ProfileService} from './profile.service';
import {ProxyStorageService} from './proxy-storage.service';
import {ProxyService} from './proxy.service';
import {SecretService} from './secret.service';
import {SettingService} from './setting.service';
import {TunnelService} from './tunnel.service';
import {EncryptedConfigStoreService} from './config-store.service';

@Injectable({
  providedIn: 'root'
})
export class CloudService extends EncryptedConfigStoreService<CloudSettings> {

  static OPTIONS = [
    SettingService.CLOUD_OPTION,
    ProfileService.CLOUD_OPTION,
    SecretService.CLOUD_OPTION,
    ProxyService.CLOUD_OPTION,
    TunnelService.CLOUD_OPTION
  ];

  private _cloud!: CloudSettings;

  constructor(
    private proxyStorage: ProxyStorageService,
    log: LogService,
    electron: ElectronService,
    masterKeyService: MasterKeyService,
    notification: NotificationService,
  ) {
    super(electron, log, notification, masterKeyService, {
      loadedEvent: CLOUD_LOADED,
      storeLabel: 'cloud',
      reload: () => electron.reloadCloud(),
    });
  }

  // ---- EncryptedConfigStoreService contract ----

  protected override blank(): CloudSettings {
    return new CloudSettings();
  }

  protected override read(): CloudSettings {
    return this._cloud;
  }

  protected override write(data: CloudSettings): void {
    this._cloud = data;
  }

  protected override readonly compatVersion = Compatibility.cloud;
  protected override readonly incompatibleMessage =
    "Your application is not compatible with saved settings, please update your app. For instance, we'll use default cloud settings";
  protected override readonly clearedMessage = 'Cloud Settings cleared';

  protected override saveToMain(encrypted: string): unknown {
    return this.electron.saveCloud(encrypted);
  }

  /** Cloud settings carry no revision and empty saves are skipped. */
  protected override stampRevision = false;
  protected override createBlankOnSave = false;

  // ---- Domain API (unchanged) ----

  get cloud(): CloudSettings {
    if (!this._cloud) {
      this._cloud = new CloudSettings();
    }
    return this._cloud;
  }

  async save(cloud: CloudSettings = this._cloud) {
    await this.persist(cloud);
  }

  async upload(cloudSettings: CloudSettings): Promise<CloudResponse> {
    const result = await this.electron.uploadCloud(cloudSettings);
    return result ?? { succeed: false, ok: [], ko: ['Upload failed: no response from backend'] };
  }

  async download(cloudSettings: CloudSettings): Promise<CloudResponse> {
    const result = await this.electron.downloadCloud(cloudSettings);
    return result ?? { succeed: false, ok: [], ko: ['Download failed: no response from backend'] };
  }

  async backup(items: string[]): Promise<CloudResponse> {
    const result = await this.electron.backupSettings(items);
    return result ?? { succeed: false, ok: [], ko: ['Backup failed: no response from backend'] };
  }
}
