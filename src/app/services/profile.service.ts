import {Injectable} from '@angular/core';
import {Subject} from 'rxjs';
import {Compatibility} from '../compatibility';
import {Group} from '../domain/Group';
import {Profile, Profiles} from '../domain/profile/Profile';
import {PluginRegistryService} from '../plugin/services/plugin-registry.service';
import {Secret} from '../domain/Secret';
import {Tag} from '../domain/Tag';
import {ElectronService} from './electron/electron.service';
import {PROFILES_LOADED} from './electron/ElectronConstant';
import {LogService} from './log.service';
import {MasterKeyService} from './master-key.service';
import {NotificationService} from './notification.service';
import {EncryptedConfigStoreService} from './config-store.service';

@Injectable({
  providedIn: 'root'
})
export class ProfileService extends EncryptedConfigStoreService<Profiles> {

  static CLOUD_OPTION = 'Profile';
  private _profiles!: Profiles;

  private connectionEventSubject = new Subject<Profile>();
  connectionEvent$ = this.connectionEventSubject.asObservable();

  constructor(
    log: LogService,
    electron: ElectronService,
    masterKeyService: MasterKeyService,
    notification: NotificationService,
    private registry: PluginRegistryService,
  ) {
    super(electron, log, notification, masterKeyService, {
      loadedEvent: PROFILES_LOADED,
      storeLabel: 'profiles',
      reload: () => electron.reloadProfiles(),
    });
  }

  // ---- EncryptedConfigStoreService contract ----

  protected override blank(): Profiles {
    return new Profiles();
  }

  protected override read(): Profiles {
    return this._profiles;
  }

  protected override write(data: Profiles): void {
    this._profiles = data;
  }

  protected override readonly compatVersion = Compatibility.profiles;
  protected override readonly incompatibleMessage =
    "Your application is not compatible with saved settings, please update your app. For instance, empty profiles applied";
  protected override readonly clearedMessage = 'Profiles cleared';

  protected override saveToMain(encrypted: string): unknown {
    return this.electron.saveProfiles(encrypted);
  }

  protected override postLoad(): void {
    // Deserialize plain objects back to Profile instances
    if (this._profiles?.profiles) {
      this._profiles.profiles = this._profiles.profiles.map((p: any) => Profile.deserialize(p));
    }
  }

  protected override preSave(profiles: Profiles): void {
    for (const one of profiles.profiles) {
      one.isNew = false;
      one.icon = this.registry.getProfileIcon(one.profileType);
    }
  }

  // ---- Domain API (unchanged) ----

  // NOTE: if you add any field on Profiles, you need copy it here
  get profilesCopy(): Profiles {
    let result = new Profiles(); // to avoid if this._profiles is deserialized we don't have fn on it
    if (this._profiles) {
      result.profiles = [...this._profiles.profiles]; // copy the elements
      result.revision = this._profiles.revision;
      result.version = this._profiles.version;
      result.compatibleVersion = this._profiles.compatibleVersion;
    }
    return result;
  }

  get profiles(): Profiles {
    return this._profiles;
  }

  async save(profiles: Profiles = this._profiles) {
    await this.persist(profiles);
  }

  onProfileConnect(data: Profile) {
    this.connectionEventSubject.next(data);
  }

  async removeTag(tag: Tag) {
    for(let profile of this._profiles?.profiles ?? []) {
      profile.tags = profile.tags?.filter(one => one != tag.id)
    }
    await this.save();
  }

  async removeGroup(group: Group) {
    for(let profile of this._profiles?.profiles ?? []) {
      if (profile.group == group.id) {
        profile.group = '';
      }
    }
    await this.save();
  }

  isSecretUsed(secret: Secret) {
    return this._profiles?.profiles?.find(one => Profile.useSecret(one, secret));
  }

  clearSecret(secret: Secret) {
    this._profiles?.profiles?.filter(one => Profile.useSecret(one, secret))
      .forEach(one => Profile.clearSecret(one, secret));
    this.save();
  }
}
