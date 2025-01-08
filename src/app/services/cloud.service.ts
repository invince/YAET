import {Injectable, OnDestroy} from '@angular/core';
import {CloudSettings} from '../domain/setting/CloudSettings';
import {ElectronService} from './electron.service';
import {MasterKeyService} from './master-key.service';
import {CLOUD_LOADED} from '../domain/electronConstant';
import {CloudResponse} from '../domain/setting/CloudResponse';
import {SettingService} from './setting.service';
import {ProfileService} from './profile.service';
import {SecretService} from './secret.service';
import packageJson from '../../../package.json';
import {Subscription} from 'rxjs';
import {Compatibility} from '../../main';
import {LogService} from './log.service';
import {compareVersions} from '../utils/VersionUtils';
import {NotificationService} from './notification.service';

@Injectable({
  providedIn: 'root'
})
export class CloudService implements OnDestroy {

  static OPTIONS = [SettingService.CLOUD_OPTION, ProfileService.CLOUD_OPTION, SecretService.CLOUD_OPTION];

  private _cloud!: CloudSettings;
  private _loaded: boolean = false;
  subscriptions: Subscription[] = []

  constructor(
    private log: LogService,
    private electron: ElectronService,
    private masterKeyService: MasterKeyService,
    private notification: NotificationService,
    ) {
    electron.onLoadedEvent(CLOUD_LOADED, data => this.apply(data));
    this.subscriptions.push(masterKeyService.updateEvent$.subscribe(event => {
      if(event === 'invalid') {
        this._cloud = new CloudSettings();
        this.save();
        this.notification.info('Cloud Settings cleared');
      } else {
        this.save();
        this.notification.info('Cloud Settings re-encrypted');
      }
    }));
  }

  ngOnDestroy(): void {
    if (this.subscriptions) {
      this.subscriptions.forEach(one => one.unsubscribe());
    }
  }


  private apply(data: any) {
    if (!data) {
      this._loaded = true; // this means you don't have cloud yet
      return;
    }
    this.masterKeyService.decrypt2String(data).then(
      decrypted => {
        if (decrypted) {
          let dataObj = JSON.parse(decrypted);
          if (dataObj) {
            if (dataObj.compatibleVersion) {
              if (compareVersions(dataObj.compatibleVersion, packageJson.version) > 0) {
                let msg = "Your application is not compatible with saved settings, please update your app. For instance, we'll use default cloud settings";
                this.log.warn(msg);
                this.notification.info(msg);
                dataObj = new CloudSettings();
              }
            }
          }

          this._cloud =  dataObj;
          this._loaded = true;
        }
      }
    )
  }

  get isLoaded() {
    return this._loaded;
  }

  get cloud(): CloudSettings {
    if (!this._cloud) {
      this._cloud = new CloudSettings();
    }
    return this._cloud;
  }


  async save(cloud: CloudSettings = this._cloud) {
    if (!cloud) {
      return;
    }
    this._cloud = cloud;
    this._cloud.version = packageJson.version;
    this._cloud.compatibleVersion = Compatibility.cloud;
    this.masterKeyService.encrypt(this._cloud).then(
      encrypted => {
        if (encrypted) {
          this.electron.saveCloud(encrypted);
        }
      }
    )
  }

  reload() {
    this._loaded = false;
    this.electron.reloadCloud();
  }

  async upload(cloudSettings: CloudSettings): Promise<CloudResponse | undefined> {
    return await this.electron.uploadCloud(cloudSettings);
  }

  async download(cloudSettings: CloudSettings):  Promise<CloudResponse | undefined>  {
    return await this.electron.downloadCloud(cloudSettings); // after download a CLOUD_LOADED will be sent
  }
}
