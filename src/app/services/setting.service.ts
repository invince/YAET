import {Injectable} from '@angular/core';
import {MySettings} from '../domain/MySettings';
import {Profile} from '../domain/Profile';
import {ElectronService} from './electron.service';
import {SETTINGS_LOADED} from './electronConstant';
import {LocalTerminalProfile, LocalTerminalType} from '../domain/LocalTerminalProfile';
import {Subject} from 'rxjs';
import {SettingStorageService} from './setting-storage.service';

@Injectable({
  providedIn: 'root'
})
export class SettingService {

  private settingLoadedSubject = new Subject<any>();
  settingLoadedEvent = this.settingLoadedSubject.asObservable(); // Expose as Observable


  private _loaded: boolean = false;

  constructor(
    private electron: ElectronService,
    private settingStorage: SettingStorageService,
    ) {
    electron.onLoadedEvent(SETTINGS_LOADED, data => this.apply(data))
  }

  private apply(data: any) {
    if (typeof data === "string") {
      this.settingStorage.settings = JSON.parse(data);
    } else {
      this.settingStorage.settings = data;
    }
    this.validate(this.settingStorage.settings);
    this._loaded = true;
    this.settingLoadedSubject.next({})
  }

  get isLoaded() {
    return this._loaded;
  }

  createLocalTerminalProfile() : Profile {
    let profile = new Profile();
    profile.localTerminal = this.settingStorage.settings.localTerminal;
    return profile;
  }


  save(settings: MySettings) {
    this.settingStorage.settings = settings;
    this.electron.saveSetting(settings);
  }

  validate(_settings: MySettings) {
    if (_settings) {
      this.validateLocalTerminalSettings(_settings.localTerminal);
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
