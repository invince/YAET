import {LocalTerminalProfile} from './LocalTerminalProfile';
import {v4 as uuidv4} from 'uuid';
import {SSHTerminalProfile} from './SSHTerminalProfile';
import {Secret} from './Secret';

export enum ProfileCategory {
  TERMINAL = 'TERMINAL',
  REMOTE_DESKTOP = 'REMOTE_DESKTOP',
  FILE_EXPLORER = 'FILE_EXPLORER'
}

export enum ProfileType {
  LOCAL_TERMINAL = 'LOCAL_TERMINAL',
  SSH_TERMINAL = 'SSH_TERMINAL',
  TELNET_TERMINAL = 'TELNET_TERMINAL',

  REAL_VNC_REMOTE_DESKTOP = 'REAL_VNC_REMOTE_DESKTOP',
  TIGHT_VNC_REMOTE_DESKTOP = 'TIGHT_VNC_REMOTE_DESKTOP',
  RDP_REMOTE_DESKTOP = 'RDP_REMOTE_DESKTOP',
  SCP_FILE_EXPLORER = 'SCP_FILE_EXPLORER',
  SFTP_FILE_EXPLORER = 'SFTP_FILE_EXPLORER',
}

export const ProfileCategoryTypeMap = new Map<ProfileCategory, any>([
  [ProfileCategory.TERMINAL, [
    // ProfileType.LOCAL_TERMINAL,
    ProfileType.SSH_TERMINAL,
    ProfileType.TELNET_TERMINAL,
  ]],

  [ProfileCategory.REMOTE_DESKTOP, [
    ProfileType.REAL_VNC_REMOTE_DESKTOP,
    ProfileType.TIGHT_VNC_REMOTE_DESKTOP,
    ProfileType.RDP_REMOTE_DESKTOP,
  ]],


  [ProfileCategory.FILE_EXPLORER, [
    ProfileType.SCP_FILE_EXPLORER,
    ProfileType.SFTP_FILE_EXPLORER,
  ]],
]);

export class Profiles {

  revision: number;

  profiles: Profile[];

  constructor() {
    this.revision = Date.now();
    this.profiles = [];
  }

}


export class Profile {

  readonly id: string = uuidv4(); // uuid
  public name: string = '';

  public comment:string = '';

  public category!: ProfileCategory;
  public profileType!: ProfileType;
  public localTerminal!: LocalTerminalProfile;
  public sshTerminalProfile!: SSHTerminalProfile;

  public group!: string
  public tags: string[] = [];

  isNew: boolean = true;


  constructor() {
    this.localTerminal = new LocalTerminalProfile();
    this.sshTerminalProfile = new SSHTerminalProfile();
  }
}
