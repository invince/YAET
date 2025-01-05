import {Injectable, OnDestroy} from '@angular/core';
import {Profile, Profiles, ProfileType} from '../domain/profile/Profile';
import {ElectronService} from './electron.service';
import {PROFILES_LOADED} from '../domain/electronConstant';
import {Subject, Subscription} from 'rxjs';
import {MasterKeyService} from './master-key.service';
import {Tag} from '../domain/Tag';
import {Group} from '../domain/Group';
import packageJson from '../../../package.json';
import {LogService} from './log.service';
import {Compatibility} from '../../main';
import {compareVersions} from '../utils/Utils';
import {NotificationService} from './notification.service';
import {Secret} from '../domain/Secret';

@Injectable({
  providedIn: 'root'
})
export class ProfileService implements OnDestroy{

  static CLOUD_OPTION = 'Profile';
  private _profiles!: Profiles;

  private _loaded: boolean = false;
  private subscriptions: Subscription[] =[];

  private connectionEventSubject = new Subject<Profile>();
  connectionEvent$ = this.connectionEventSubject.asObservable();



  constructor(
    private log: LogService,
    private electron: ElectronService,
    private masterKeyService: MasterKeyService,

    private notification: NotificationService,

  ) {
    electron.onLoadedEvent(PROFILES_LOADED, data => this.apply(data));

    this.subscriptions.push(masterKeyService.updateEvent$.subscribe(event => {
      if(event === 'invalid') {
        this._profiles = new Profiles();
        this.save();
        this.notification.info('Profiles cleared');
      } else {
        this.save();
        this.notification.info('Profiles re-encrypted');
      }
    }));
  }

  private apply(data: any) {
    if (!data) {
      this._loaded = true; // this means you don't have profile yet
      return;
    }
    this.masterKeyService.decrypt2String(data).then(
      decrypted => {
        if (decrypted) {
          let dataObj = JSON.parse(decrypted);
          if (dataObj) {
            if (dataObj.compatibleVersion) {
              if (compareVersions(dataObj.compatibleVersion, packageJson.version) > 0) {
                let msg = "Your application is not compatible with saved settings, please update your app. For instance, empty profiles applied";
                this.log.warn(msg);
                this.notification.info(msg);
                dataObj = new Profiles();
              }
            }
          }
          this._profiles =  dataObj;
          this._loaded = true;
        }
      }
    )
  }

  get isLoaded() {
    return this._loaded;
  }

  // NOTE: if you add any field on Profiles, you need copy it here
  get profiles(): Profiles {
    let result = new Profiles(); // to avoid if this._profiles is deserialized we don't have fn on it
    if (this._profiles) {
      result.profiles = [...this._profiles.profiles]; // copy the elements
      result.revision = this._profiles.revision;
      result.version = this._profiles.version;
      result.compatibleVersion = this._profiles.compatibleVersion;
    }
    return result;
  }

  async save(profiles: Profiles = this.profiles) {
    if (!profiles) {
      profiles = new Profiles();
    }
    this._profiles = profiles;
    this._profiles.version = packageJson.version;
    this._profiles.compatibleVersion = Compatibility.profiles;
    for (let one of this._profiles.profiles) {
      one.isNew = false;

      switch (one.profileType) {
        case ProfileType.LOCAL_TERMINAL:
        case ProfileType.SSH_TERMINAL:
        case ProfileType.TELNET_TERMINAL:
          one.icon = 'terminal'; break;

        case ProfileType.VNC_REMOTE_DESKTOP:
        case ProfileType.RDP_REMOTE_DESKTOP:
          one.icon = 'computer'; break;

        case ProfileType.SCP_FILE_EXPLORER:
        case ProfileType.SMB_FILE_EXPLORER:
          one.icon = 'folder'; break;
        case ProfileType.CUSTOM:
          one.icon = 'star'; break;
      }

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

  ngOnDestroy(): void {
    if (this.subscriptions) {
      this.subscriptions.forEach(one => one.unsubscribe());
    }
  }

  isSecretUsed(secret: Secret) {
    return this._profiles.profiles.find(one => Profile.useSecret(one, secret));
  }

  clearSecret(secret: Secret) {
    this._profiles.profiles.filter(one => Profile.useSecret(one, secret))
      .forEach(one => Profile.clearSecret(one, secret));
    this.save();
  }
}
