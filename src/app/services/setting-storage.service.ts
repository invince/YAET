import { Injectable } from '@angular/core';
import {MySettings} from '../domain/MySettings';

@Injectable({
  providedIn: 'root'
})
export class SettingStorageService {

  private _settings!: MySettings;
  constructor() { }

  get settings(): MySettings {
    if (!this._settings) {
      this._settings = new MySettings();
    }
    return this._settings;
  }

  set settings(settings1:MySettings) {
    this._settings = settings1;
  }
}
