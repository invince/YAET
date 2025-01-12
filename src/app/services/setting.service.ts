import {Injectable} from '@angular/core';
import {MySettings} from '../domain/setting/MySettings';
import {Profile} from '../domain/profile/Profile';
import {ElectronService} from './electron.service';
import {SETTINGS_LOADED} from '../domain/electronConstant';
import {LocalTerminalType} from '../domain/profile/LocalTerminalProfile';
import {Subject} from 'rxjs';
import {SettingStorageService} from './setting-storage.service';
import {Tag} from '../domain/Tag';
import {ProfileService} from './profile.service';
import {Group} from '../domain/Group';
import packageJson from '../../../package.json';
import {RemoteDesktopSettings} from '../domain/setting/RemoteDesktopSettings';
import {FileExplorerSettings} from '../domain/setting/FileExplorerSettings';
import {TerminalSettings} from '../domain/setting/TerminalSettings';
import {LogService} from './log.service';
import {Compatibility} from '../../main';
import {compareVersions} from '../utils/VersionUtils';
import {NotificationService} from './notification.service';


@Injectable({
  providedIn: 'root'
})
export class SettingService {

  static CLOUD_OPTION = 'Setting';
  private settingLoadedSubject = new Subject<any>();
  settingLoadedEvent = this.settingLoadedSubject.asObservable(); // Expose as Observable


  private _loaded: boolean = false;

  constructor(
    private log: LogService,
    private electron: ElectronService,
    private settingStorage: SettingStorageService,
    private profileService: ProfileService,
    private notification: NotificationService,
    ) {
    electron.onLoadedEvent(SETTINGS_LOADED, data => this.apply(data));
  }

  private apply(data: any) {
    if (data) {
      let dataObj: any;
      if (typeof data === "string") {
        dataObj = JSON.parse(data);
      } else {
        dataObj = data;
      }

      if (dataObj) {
        if (dataObj.compatibleVersion) {
          if (compareVersions(dataObj.compatibleVersion, packageJson.version) > 0) {
            let msg = "Your application is not compatible with saved settings, please update your app. For instance, we'll use default settings";
            this.log.warn(msg);
            this.notification.info(msg);
            dataObj = new MySettings();
          }
        }

        this.settingStorage.settings = dataObj;
      } else {
        this.settingStorage.settings = new MySettings();
      }


      this.validate(this.settingStorage.settings);
    }
    this._loaded = true;
    this.settingLoadedSubject.next({})
  }

  get isLoaded() {
    return this._loaded;
  }

  createLocalTerminalProfile() : Profile {
    let profile = new Profile();
    profile.localTerminal = this.settingStorage.settings.terminal.localTerminal;
    return profile;
  }

  save(settings: MySettings | undefined = undefined) {
    if (settings) {
      settings.isNew = false;
      settings.version = packageJson.version;
      settings.compatibleVersion = Compatibility.settings;
      settings.revision = Date.now();

      this.settingStorage.settings = settings;
    }
    this.electron.saveSetting(this.settingStorage.settings);
  }

  validate(_settings: MySettings) {
    if (_settings) {
      this.validateTerminalSettings(_settings.terminal);
      this.validateRemoteDesktopSettings(_settings.remoteDesktop);
      this.validateFileExplorerSettings(_settings.fileExplorer);
    }
  }

  private validateFileExplorerSettings(fileExplorer: FileExplorerSettings) {

  }

  private validateRemoteDesktopSettings(remoteDesk: RemoteDesktopSettings) {

  }

  validateTerminalSettings(terminalSettings: TerminalSettings) {
    if (terminalSettings.localTerminal) {
      if (!terminalSettings.localTerminal.type) {
        terminalSettings.localTerminal.type = LocalTerminalType.CMD;
      }
      switch (terminalSettings.localTerminal.type) {
        case LocalTerminalType.CMD: terminalSettings.localTerminal.execPath = 'cmd.exe'; break;
        case LocalTerminalType.POWERSHELL: terminalSettings.localTerminal.execPath = 'powershell.exe'; break;
        case LocalTerminalType.BASH: {
          if (process.platform === 'win32') {
            terminalSettings.localTerminal.execPath = 'wsl.exe';
          } else {
            terminalSettings.localTerminal.execPath = 'bash';
          }
        } break;
        // case LocalTerminalType.CUSTOM: terminalSettings.localTerminal.execPath = ''; break;
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
