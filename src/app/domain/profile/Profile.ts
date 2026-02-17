import {CustomProfile} from './CustomProfile';
import {FTPProfile} from './FTPProfile';
import {LocalTerminalProfile} from './LocalTerminalProfile';
import {RdpProfile} from './RdpProfile';
import {RemoteTerminalProfile} from './RemoteTerminalProfile';
import {SambaProfile} from './SambaProfile';
import {VncProfile} from './VncProfile';

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
    ProfileType.LOCAL_TERMINAL,
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
  profiles: Profile[];
  version: string = '';
  compatibleVersion: string = '';

  constructor() {
    this.revision = Date.now();
    this.profiles = [];
  }

  update(profile: Profile) {
    const index = this.profiles.findIndex(p => p.id === profile.id);
    if (index >= 0) {
      this.profiles[index] = profile;
    } else {
      this.profiles.push(profile);
    }
  }

  delete(profile: Profile) {
    const index = this.profiles.findIndex(p => p.id === profile.id);
    if (index >= 0) {
      this.profiles.splice(index, 1);
    }
  }
}

export class Profile {

  public id: string = '';
  public name: string = '';
  public comment: string = '';
  public icon: string = 'terminal';
  public category: ProfileCategory = ProfileCategory.TERMINAL;
  public profileType: ProfileType = ProfileType.LOCAL_TERMINAL;
  public group: string = '';
  public tags: string[] = [];
  public proxyId: string = '';

  public localTerminal: LocalTerminalProfile;
  public sshProfile: RemoteTerminalProfile;
  public telnetProfile: RemoteTerminalProfile;
  public winRmProfile: RemoteTerminalProfile;

  public ftpProfile: FTPProfile;
  public sambaProfile: SambaProfile;

  public rdpProfile: RdpProfile;
  public vncProfile: VncProfile;

  public customProfile: CustomProfile;

  public isNew: boolean = true;


  constructor() {
    this.id = Math.random().toString(36).substring(2);
    this.localTerminal = new LocalTerminalProfile();
    this.sshProfile = new RemoteTerminalProfile();
    this.telnetProfile = new RemoteTerminalProfile(23);
    this.winRmProfile = new RemoteTerminalProfile();

    this.ftpProfile = new FTPProfile();
    this.sambaProfile = new SambaProfile();

    this.rdpProfile = new RdpProfile();
    this.vncProfile = new VncProfile();

    this.customProfile = new CustomProfile();
  }

  static clone(base: Profile): Profile {
    const cloned = new Profile();
    cloned.id = base.id; // Usually we want a new ID, but some logic might need it
    cloned.name = base.name;
    cloned.comment = base.comment;
    cloned.category = base.category;
    cloned.profileType = base.profileType;

    cloned.localTerminal = base.localTerminal;
    cloned.sshProfile = base.sshProfile;
    cloned.telnetProfile = base.telnetProfile;
    cloned.winRmProfile = base.winRmProfile;

    cloned.ftpProfile = base.ftpProfile;
    cloned.sambaProfile = base.sambaProfile;

    cloned.rdpProfile = base.rdpProfile;
    cloned.vncProfile = base.vncProfile;

    cloned.customProfile = base.customProfile;
    cloned.group = base.group;
    cloned.tags = base.tags;
    cloned.proxyId = base.proxyId;

    return cloned;
  }

  static requireOpenNewTab(profile: Profile) {
    return ![ProfileType.RDP_REMOTE_DESKTOP, ProfileType.CUSTOM]
      .includes(profile.profileType);
  }

  static useSecret(one: Profile, secret: any) {
    if (one.sshProfile?.secretId == secret?.id) return true;
    if (one.telnetProfile?.secretId == secret?.id) return true;
    if (one.winRmProfile?.secretId == secret?.id) return true;
    if (one.ftpProfile?.secretId == secret?.id) return true;
    if (one.sambaProfile?.secretId == secret?.id) return true;
    if (one.vncProfile?.secretId == secret?.id) return true;
    return false;
  }

  static clearSecret(one: Profile, secret: any) {
    if (one.sshProfile?.secretId == secret.id) one.sshProfile.secretId = '';
    if (one.telnetProfile?.secretId == secret.id) one.telnetProfile.secretId = '';
    if (one.winRmProfile?.secretId == secret.id) one.winRmProfile.secretId = '';
    if (one.ftpProfile?.secretId == secret.id) one.ftpProfile.secretId = '';
    if (one.sambaProfile?.secretId == secret.id) one.sambaProfile.secretId = '';
    if (one.vncProfile?.secretId == secret.id) one.vncProfile.secretId = '';
  }
}
