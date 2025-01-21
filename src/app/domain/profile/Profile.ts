import {LocalTerminalProfile} from './LocalTerminalProfile';
import {v4 as uuidv4} from 'uuid';
import {RemoteTerminalProfile} from './RemoteTerminalProfile';
import {Secret} from '../Secret';
import {RdpProfile} from './RdpProfile';
import {VncProfile} from './VncProfile';
import {CustomProfile} from './CustomProfile';
import {FTPProfile} from './FTPProfile';
import {SambaProfile} from './SambaProfile';

export enum ProfileCategory {
  TERMINAL = 'TERMINAL',
  REMOTE_DESKTOP = 'REMOTE_DESKTOP',
  FILE_EXPLORER = 'FILE_EXPLORER',
  CUSTOM = 'CUSTOM',
}

export enum ProfileType {
  LOCAL_TERMINAL = 'LOCAL_TERMINAL',
  SSH_TERMINAL = 'SSH_TERMINAL',
  TELNET_TERMINAL = 'TELNET_TERMINAL',
  WIN_RM_TERMINAL = 'WIN_RM_TERMINAL',

  VNC_REMOTE_DESKTOP = 'VNC_REMOTE_DESKTOP',
  RDP_REMOTE_DESKTOP = 'RDP_REMOTE_DESKTOP',
  SCP_FILE_EXPLORER = 'SCP_FILE_EXPLORER',
  FTP_FILE_EXPLORER = 'FTP_FILE_EXPLORER',
  SAMBA_FILE_EXPLORER = 'SAMBA_FILE_EXPLORER',

  CUSTOM = 'CUSTOM',
}

export const ProfileCategoryTypeMap = new Map<ProfileCategory, any>([
  [ProfileCategory.TERMINAL, [
    ProfileType.SSH_TERMINAL,
    ProfileType.TELNET_TERMINAL,
    ProfileType.WIN_RM_TERMINAL,
  ]],

  [ProfileCategory.REMOTE_DESKTOP, [
    ProfileType.VNC_REMOTE_DESKTOP,
    ProfileType.RDP_REMOTE_DESKTOP,
  ]],


  [ProfileCategory.FILE_EXPLORER, [
    ProfileType.SCP_FILE_EXPLORER,
    ProfileType.FTP_FILE_EXPLORER,
    ProfileType.SAMBA_FILE_EXPLORER,
  ]],

  [ProfileCategory.CUSTOM, [
    ProfileType.CUSTOM,
  ]],
]);

export class Profiles {

  revision: number;

  public version: string = '';
  public compatibleVersion: string = '';

  profiles: Profile[];

  constructor() {
    this.revision = Date.now();
    this.profiles = [];
  }

  delete($event: Profile) {
    if (!$event) {
      return;
    }
    if (!this.profiles) {
      this.profiles = [];
    }
    this.profiles = this.profiles.filter(one => one.id != $event.id);
  }

  update($event: Profile) {
    if ($event) {
      let index = this.profiles.findIndex(one => one.id == $event.id);
      if (index >= 0) {
        this.profiles[index] = $event;
      } else {
        console.warn("Profile not found, we'll add new profile");
        this.profiles.push($event);
      }
    }
  }
}


export class Profile {

  readonly id: string = uuidv4(); // uuid
  public name: string = '';

  public icon: string = '';
  public comment:string = '';

  public category!: ProfileCategory;
  public profileType!: ProfileType;

  public localTerminal!: LocalTerminalProfile;
  public sshProfile!: RemoteTerminalProfile;
  public telnetProfile!: RemoteTerminalProfile;
  public winRmProfile!: RemoteTerminalProfile;

  public ftpProfile!: FTPProfile;
  public sambaProfile!: SambaProfile;

  public rdpProfile!: RdpProfile;
  public vncProfile!: VncProfile;

  public customProfile!: CustomProfile;

  public group!: string
  public tags: string[] = [];

  isNew: boolean = true;


  constructor() {
    this.localTerminal = new LocalTerminalProfile();
    this.sshProfile = new RemoteTerminalProfile();
    this.telnetProfile = new RemoteTerminalProfile(23);
    this.winRmProfile = new RemoteTerminalProfile(); // port is not important

    this.ftpProfile = new FTPProfile();
    this.sambaProfile= new SambaProfile();

    this.rdpProfile = new RdpProfile();
    this.vncProfile = new VncProfile();
    this.customProfile = new CustomProfile();
  }

  static clone(base: Profile): Profile {
    let cloned = new Profile();

    cloned.name = base.name;
    cloned.icon = base.icon;
    cloned.category = base.category;
    cloned.profileType = base.profileType;

    cloned.localTerminal = base.localTerminal;
    cloned.sshProfile = base.sshProfile;
    cloned.telnetProfile = base.telnetProfile;
    cloned.winRmProfile = base.winRmProfile;

    cloned.ftpProfile = base.ftpProfile;
    cloned.sambaProfile = base.sambaProfile;

    cloned.vncProfile = base.vncProfile;
    cloned.rdpProfile = base.rdpProfile;

    cloned.customProfile = base.customProfile;
    cloned.group = base.group;
    cloned.tags = base.tags;

    return cloned;
  }

  static requireOpenNewTab(profile: Profile) {
    return ![ProfileType.RDP_REMOTE_DESKTOP, ProfileType.CUSTOM]
      .includes(profile.profileType);
  }

  static useSecret(profile: Profile, secret: Secret) {
    if (profile && secret) {
      switch (profile.profileType) {
        case ProfileType.SCP_FILE_EXPLORER:
        case ProfileType.SSH_TERMINAL: return profile.sshProfile.secretId == secret.id;
        case ProfileType.TELNET_TERMINAL: return profile.telnetProfile.secretId == secret.id;
        case ProfileType.FTP_FILE_EXPLORER: return profile.ftpProfile.secretId == secret.id;

        case ProfileType.VNC_REMOTE_DESKTOP: return profile.vncProfile.secretId == secret.id;
        case ProfileType.CUSTOM: return profile.customProfile.secretId == secret.id;
      }
    }
    return false;
  }


  static clearSecret(profile: Profile, secret: Secret) {
    if (profile && secret) {
      switch (profile.profileType) {
        case ProfileType.SCP_FILE_EXPLORER:
        case ProfileType.SSH_TERMINAL:
          profile.sshProfile.secretId = ''; break;
        case ProfileType.TELNET_TERMINAL:
          profile.telnetProfile.secretId = ''; break;
        case ProfileType.FTP_FILE_EXPLORER:
          profile.ftpProfile.secretId = ''; break;
        case ProfileType.VNC_REMOTE_DESKTOP:
          profile.vncProfile.secretId = ''; break;
        case ProfileType.CUSTOM:
          profile.customProfile.secretId = ''; break;
      }
    }
  }

}
