import { Injectable } from '@angular/core';
import {Profile} from '../domain/Profile';
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

  private _profiles!: Profile[];

  private _loaded: boolean = false;

  private connectionEventSubject = new Subject<Profile>();
  connectionEvent$ = this.connectionEventSubject.asObservable();



  constructor(
    private electron: ElectronService,
    private masterKeyService: MasterKeyService,

  ) {
    electron.onLoadedEvent(PROFILES_LOADED, data => this.apply(data))
  }

  private apply(data: any) {
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

  set profiles(value: Profile[]) {
    this._profiles = value;
  }
  get profiles(): Profile[] {
    if (!this._profiles) {
      this._profiles = [];
    }
    return this._profiles;
  }

  async save(profile: Profile) {
    if (!this._profiles) {
      this._profiles = [];
    }
    if (!profile) {
      return;
    }
    this.updateOrAdd(profile);
    for (let one of this._profiles) {
      one.isNew = false;
    }
    this.masterKeyService.encrypt(this._profiles).then(
      encrypted => {
        if (encrypted) {
          this.electron.saveProfiles(encrypted);
        }
      }
    )
  }

  updateOrAdd(profile: Profile) {
    for (let i = 0; i < this._profiles.length; i++) {
      const one = this._profiles[i];
      if (one.id == profile.id) {
        this._profiles[i] = profile;
        return;
      }
    }

    this._profiles.push(profile);

  }


  reload() {
    this._loaded = false;
    this.electron.reloadProfiles();
  }

  deleteLocal($event: Profile) {
    if (!$event) {
      return;
    }
    if (!this._profiles) {
      this._profiles = [];
    }
    this._profiles = this._profiles.filter(one => one.id != $event.id);
  }

  async saveAll() {
    if (!this._profiles) {
      return;
    }
    for (let one of this._profiles) {
      one.isNew = false;
    }
    this.masterKeyService.encrypt(this._profiles).then(
      encrypted => {
        if (encrypted) {
          this.electron.saveProfiles(encrypted);
        }
      }
    )
  }


  onProfileConnect(data: Profile) {
    this.connectionEventSubject.next(data);
  }

  async removeTag(tag: Tag) {
    for(let profile of this._profiles) {
      profile.tags = profile.tags?.filter(one => one != tag.id)
    }
    await this.saveAll();
  }

  async removeGroup(group: Group) {
    for(let profile of this._profiles) {
      if (profile.group == group.id) {
        profile.group = '';
      }
    }
    await this.saveAll();
  }

  deleteNotSavedNewProfileInLocal() {
    this._profiles = this._profiles.filter(one => !one.isNew);
  }
}
