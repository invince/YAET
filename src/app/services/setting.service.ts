import {Injectable} from '@angular/core';
import {MySettings} from '../domain/MySettings';
import {Profile} from '../domain/Profile';
import {ElectronService} from './electron.service';
import {SETTINGS_LOADED} from './electronConstant';
import {LocalTerminalProfile, LocalTerminalType} from '../domain/LocalTerminalProfile';
import {Subject} from 'rxjs';
import {SettingStorageService} from './setting-storage.service';
import {Tag} from '../domain/Tag';
import {ProfileService} from './profile.service';
import {Group} from '../domain/Group';

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
    private profileService: ProfileService,
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

  save(settings: MySettings | undefined = undefined) {
    if (settings) {
      this.settingStorage.settings = settings;
    }
    this.electron.saveSetting(this.settingStorage.settings);
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
        case LocalTerminalType.BASH: localTerminalSetting.execPath = 'bash'; break;
        case LocalTerminalType.CUSTOM: localTerminalSetting.execPath = ''; break;
      }
    }
  }

  reload() {
    this._loaded = false;
    this.electron.reloadSettings();
  }

  findGroupById(id: string): Group | undefined {
    return this.settingStorage.settings.groups
      .find(one => one.id == id)
  }

  findTagById(id: string): Tag | undefined {
    return this.settingStorage.settings.tags
      .find(one => one.id == id)
  }

  existGroup(value: string, excludeId: string = '') {
    if (!value) {
      return true; // exclude invalid case
    }
    return this.settingStorage.settings.groups
      .find(one => one.id != excludeId && one.name == value);
  }

  addGroup(value: string) {
    this.settingStorage.settings.groups.push(new Group(value));
    this.save();
  }


  updateGroup(group: Group, value: string) {
    if (!value || !group) {
      return;
    }
    this.settingStorage.settings.groups
      .forEach(one => {
        if (one.id == group.id) {
          one.name = value;
        }
      });
    this.save();
  }

  async removeGroup(group: Group) {
    if (group) {
      await this.profileService.removeGroup(group);
      this.settingStorage.settings.groups = this.settingStorage.settings.groups.filter(one => one.id != group.id);
    }
    this.save();
  }

  existTag(value: string, excludeId: string = '') {
    if (!value) {
      return true; // exclude invalid case
    }
    return this.settingStorage.settings.tags
      .find(one => one.id != excludeId && one.name == value);
  }

  addTag(value: string) {
    this.settingStorage.settings.tags.push(new Tag(value));
    this.save();
  }


  updateTag(tag: Tag, value: string) {
    if (!value || !tag) {
      return;
    }
    this.settingStorage.settings.tags
      .forEach(one => {
        if (one.id == tag.id) {
          one.name = value;
        }
      });
    this.save();
  }

  updateTagColor(tag: Tag, value: string) {
    if (!value || !tag) {
      return;
    }
    this.settingStorage.settings.tags
      .forEach(one => {
        if (one.id == tag.id) {
          one.color = value;
        }
      });
    this.save();
  }

  async removeTag(tag: Tag) {
    if (tag) {
      await this.profileService.removeTag(tag);
      this.settingStorage.settings.tags = this.settingStorage.settings.tags.filter(one => one.id != tag.id);
    }
    this.save();
  }

  updateGroupColor(group: Group, color: string) {
    if (!color || !group) {
      return;
    }
    this.settingStorage.settings.groups
      .forEach(one => {
        if (one.id == group.id) {
          one.color = color;
        }
      });
    this.save();
  }
}
