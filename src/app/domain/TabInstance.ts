import {Profile, ProfileCategory} from './Profile';



export enum TabType {
  LOCAL_TERMINAL = 'LOCAL_TERMINAL',
  SSH_TERMINAL = 'SSH_TERMINAL',
  TELNET_TERMINAL = 'TELNET_TERMINAL terminal',

  REAL_VNC_REMOTE_DESKTOP = 'REAL_VNC_REMOTE_DESKTOP',
  TIGHT_VNC_REMOTE_DESKTOP = 'TIGHT_VNC_REMOTE_DESKTOP',
  RDP_REMOTE_DESKTOP = 'RDP_REMOTE_DESKTOP',
  SCP_FILE_EXPLORER = 'SCP_FILE_EXPLORER',
  SFTP_FILE_EXPLORER = 'SFTP_FILE_EXPLORER',
}

export class TabInstance {

  readonly id: string; // uuid

  readonly tabType: TabType;
  readonly category: ProfileCategory;

  profile: Profile;


  constructor(id: string, category: ProfileCategory, type: TabType, profile: Profile) {
    this.id = id;
    this.tabType = type;
    this.category = category;
    this.profile = profile;
  }


}
