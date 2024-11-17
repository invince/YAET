import { Injectable } from '@angular/core';
import {Profile} from '../domain/Profile';
import {Settings} from '../domain/Settings';
import {ElectronService} from './electron.service';

@Injectable({
  providedIn: 'root'
})
export class ProfileService {

  private _profiles!: Profile[];

  private _loaded: boolean = false;

  constructor(private electron: ElectronService) {
    electron.onLoadedEvent('profiles-loaded', data => this.apply(data))
  }

  private apply(data: string) {
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
    return this._profiles;
  }

}
