import { Injectable } from '@angular/core';
import {Profile, Profiles} from '../domain/profile/Profile';
import {ElectronService} from './electron.service';
import {PROFILES_LOADED} from './electronConstant';
import {Subject} from 'rxjs';
import {MasterKeyService} from './master-key.service';
import {Tag} from '../domain/Tag';
import {Group} from '../domain/Group';

@Injectable({
  providedIn: 'root'
})
export class ProfileService {

  static CLOUD_OPTION = 'Profile';
  private _profiles!: Profiles;

  private _loaded: boolean = false;

  private connectionEventSubject = new Subject<Profile>();
  connectionEvent$ = this.connectionEventSubject.asObservable();



  constructor(
    private electron: ElectronService,
    private masterKeyService: MasterKeyService,

  ) {
    electron.onLoadedEvent(PROFILES_LOADED, data => this.apply(data));
  }

  private apply(data: any) {
    if (!data) {
      this._loaded = true; // this means you don't have profile yet
      return;
    }
    this.masterKeyService.decrypt2String(data).then(
      decrypted => {
        if (decrypted) {
          this._profiles =  JSON.parse(decrypted);
          this._loaded = true;
        }
      }
    )
  }

  get isLoaded() {
    return this._loaded;
  }

  get profiles(): Profiles {
    let result = new Profiles(); // to avoid if this._profiles is deserialized we don't have fn on it
    result.profiles = [...this._profiles.profiles]; // copy the elements
    return result;
  }

  async save(profiles: Profiles = this.profiles) {
    if (!profiles) {
      profiles = new Profiles();
    }
    this._profiles = profiles;
    for (let one of this._profiles.profiles) {
      one.isNew = false;
    }
    this._profiles.revision = Date.now();
    this.masterKeyService.encrypt(this._profiles).then(
      encrypted => {
        if (encrypted) {
          this.electron.saveProfiles(encrypted);
        }
      }
    )
  }

  reload() {
    this._loaded = false;
    this.electron.reloadProfiles();
  }

  onProfileConnect(data: Profile) {
    this.connectionEventSubject.next(data);
  }

  async removeTag(tag: Tag) {
    for(let profile of this._profiles.profiles) {
      profile.tags = profile.tags?.filter(one => one != tag.id)
    }
    await this.save();
  }

  async removeGroup(group: Group) {
    for(let profile of this._profiles.profiles) {
      if (profile.group == group.id) {
        profile.group = '';
      }
    }
    await this.save();
  }


}
