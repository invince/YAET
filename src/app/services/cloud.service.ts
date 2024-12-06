import { Injectable } from '@angular/core';
import {CloudSettings} from '../domain/CloudSettings';
import {ElectronService} from './electron.service';
import {MasterKeyService} from './master-key.service';
import {CLOUD_LOADED} from './electronConstant';
import {CloudResponse} from '../domain/CloudResponse';
import {SettingService} from './setting.service';
import {ProfileService} from './profile.service';
import {SecretService} from './secret.service';


@Injectable({
  providedIn: 'root'
})
export class CloudService {

  static OPTIONS = [SettingService.CLOUD_OPTION, ProfileService.CLOUD_OPTION, SecretService.CLOUD_OPTION];

  private _cloud!: CloudSettings;
  private _loaded: boolean = false;
  constructor(
    private electron: ElectronService,
    private masterKeyService: MasterKeyService,
    ) {
    electron.onLoadedEvent(CLOUD_LOADED, data => this.apply(data));
  }

  private apply(data: any) {
    this.masterKeyService.decrypt2String(data).then(
      decrypted => {
        if (decrypted) {
          this._cloud =  JSON.parse(decrypted);
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


  async save(cloud: CloudSettings) {
    if (!cloud) {
      return;
    }
    this._cloud = cloud;
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
