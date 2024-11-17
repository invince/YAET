import { Injectable } from '@angular/core';
import {MySettings} from '../domain/MySettings';
import {Profile} from '../domain/Profile';
import {ElectronService} from './electron.service';

@Injectable({
  providedIn: 'root'
})
export class SettingService {

  private _settings!: MySettings;

  private _loaded: boolean = false;

  constructor(private electron: ElectronService) {
    electron.onLoadedEvent('settings-loaded', data => this.apply(data))
  }

  private apply(data: any) {
    let jsonStr;
    if (typeof data === "string") {
      this._settings = JSON.parse(data);
    } else {
      this._settings = data;
    }
    this._loaded = true;
  }

  get isLoaded() {
    return this._loaded;
  }


  get settings(): MySettings {
    return this._settings;
  }


  createLocalTerminalProfile() : Profile {
    let profile = new Profile();
    profile.localTerminal = this._settings.localTerminalSetting;
    console.log("setting");
    console.log(profile);
    return profile;
  }


  save(settings: MySettings) {

  }
}
