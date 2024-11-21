import {Injectable} from '@angular/core';
import {MySettings} from '../domain/MySettings';
import {Profile} from '../domain/Profile';
import {ElectronService} from './electron.service';
import {SETTINGS_LOADED} from './electronConstant';
import {LocalTerminalProfile, LocalTerminalType} from '../domain/LocalTerminalProfile';
import {Subject} from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class SettingService {

  private settingLoadedSubject = new Subject<any>();
  settingLoadedEvent = this.settingLoadedSubject.asObservable(); // Expose as Observable
  private _settings!: MySettings;

  private _loaded: boolean = false;

  constructor(private electron: ElectronService) {
    electron.onLoadedEvent(SETTINGS_LOADED, data => this.apply(data))
  }

  private apply(data: any) {
    if (typeof data === "string") {
      this._settings = JSON.parse(data);
    } else {
      this._settings = data;
    }
    this.validate(this._settings);
    this._loaded = true;
    this.settingLoadedSubject.next({})
  }

  get isLoaded() {
    return this._loaded;
  }


  get settings(): MySettings {
    if (!this._settings) {
      this._settings = new MySettings();
    }
    return this._settings;
  }


  createLocalTerminalProfile() : Profile {
    let profile = new Profile();
    profile.localTerminal = this._settings.localTerminalSetting;
    return profile;
  }


  save(settings: MySettings) {
    this.electron.saveSetting(settings);
  }

  validate(_settings: MySettings) {
    if (_settings) {
      this.validateLocalTerminalSettings(_settings.localTerminalSetting);
    }
  }

  validateLocalTerminalSettings(localTerminalSetting: LocalTerminalProfile) {
    if (localTerminalSetting) {
      if (!localTerminalSetting.type) {
        localTerminalSetting.type = LocalTerminalType.CMD;
      }
      switch (localTerminalSetting.type) {
        case LocalTerminalType.CMD: localTerminalSetting.execPath = 'cmd.exe'; break;
        case LocalTerminalType.POWERSHELL: localTerminalSetting.execPath = 'powershell.exe'; break;
        case LocalTerminalType.WIN_TERMINAL: localTerminalSetting.execPath = 'wt.exe'; break;
        case LocalTerminalType.BASH: localTerminalSetting.execPath = 'bash'; break;
        case LocalTerminalType.CUSTOM: localTerminalSetting.execPath = ''; break;
      }
    }
  }

  reload() {
    this._loaded = false;
    this.electron.reloadSettings();
  }
}
