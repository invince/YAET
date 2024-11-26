import { Injectable } from '@angular/core';
import {Profile} from '../domain/Profile';
import {MySettings} from '../domain/MySettings';
import {ElectronService} from './electron.service';
import {PROFILES_LOADED} from './electronConstant';
import {Subject} from 'rxjs';
import CryptoJS from 'crypto-js';
import {Secret} from '../domain/Secret';
import {SecretService} from './secret.service';

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
    private secretService: SecretService,

  ) {
    electron.onLoadedEvent(PROFILES_LOADED, data => this.apply(data))
  }

  private apply(data: any) {
    if (typeof data === "string") {
      this._profiles = JSON.parse(data);
    } else {
      this._profiles = data;
    }
    this._loaded = true;
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
    if (!profile) {
      return;
    }
    if (!this._profiles) {
      this._profiles = [];
    }
    for (let i = 0; i < this._profiles.length; i++) {
      const one = this._profiles[i];
      if (one.id == profile.id) {
        this._profiles[i] = profile;
        return;
      }
    }

    this._profiles.push(profile);

    await this.electron.saveProfiles(this._profiles);
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
    await this.electron.saveProfiles(this._profiles);
  }


  onProfileConnect(data: Profile) {
    this.connectionEventSubject.next(data);
  }
}
