export enum ProfileCategory {
  TERMINAL = 'TERMINAL',
  REMOTE_DESKTOP = 'REMOTE_DESKTOP',
  FILE_EXPLORER = 'FILE_EXPLORER',
  CUSTOM = 'CUSTOM',
}

/** ProfileType is now a plain string — plugins define their own type constants. */
export type ProfileType = string;

/** Core profile types (the only ones the core knows about). */
export const LOCAL_TERMINAL = 'LOCAL_TERMINAL';
export const CUSTOM_PROFILE = 'CUSTOM';

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
  public profileType: ProfileType = LOCAL_TERMINAL;
  public group: string = '';
  public tags: string[] = [];
  public proxyId: string = '';
  public favoritePaths: string[] = [];

  // Generic profile data storage
  private profileData: Map<string, any> = new Map();

  public isNew: boolean = true;

  constructor() {
    this.id = Math.random().toString(36).substring(2);
  }

  getProfile(type: string): any {
    return this.profileData.get(type);
  }

  setProfile(type: string, data: any): void {
    this.profileData.set(type, data);
  }

  hasProfile(type: string): boolean {
    return this.profileData.has(type);
  }

  static clone(base: Profile): Profile {
    const cloned = new Profile();
    cloned.name = base.name + ' Clone';
    cloned.comment = base.comment;
    cloned.category = base.category;
    cloned.profileType = base.profileType;
    cloned.group = base.group;
    cloned.proxyId = base.proxyId;
    cloned.favoritePaths = base.favoritePaths ? [...base.favoritePaths] : [];

    // Clone all profile data
    base.profileData.forEach((value, key) => {
      cloned.profileData.set(key, JSON.parse(JSON.stringify(value)));
    });

    return cloned;
  }

  /**
   * Deserialize a plain object (from JSON.parse) back to a Profile instance.
   * Handles both old format (direct properties) and new format (profileData Map).
   */
  static deserialize(data: any): Profile {
    const profile = new Profile();
    if (!data) return profile;

    profile.id = data.id || '';
    profile.name = data.name || '';
    profile.comment = data.comment || '';
    profile.icon = data.icon || 'terminal';
    profile.category = data.category || ProfileCategory.TERMINAL;
    profile.profileType = data.profileType || LOCAL_TERMINAL;
    profile.group = data.group || '';
    profile.tags = data.tags || [];
    profile.proxyId = data.proxyId || '';
    profile.favoritePaths = data.favoritePaths || [];
    profile.isNew = data.isNew !== undefined ? data.isNew : true;

    // Migrate old direct properties to profileData Map
    const oldFieldMap: Record<string, string> = {
      'localTerminal': 'LOCAL_TERMINAL',
      'sshProfile': 'SSH_TERMINAL',
      'telnetProfile': 'TELNET_TERMINAL',
      'winRmProfile': 'WIN_RM_TERMINAL',
      'rdpProfile': 'RDP_REMOTE_DESKTOP',
      'vncProfile': 'VNC_REMOTE_DESKTOP',
      'ftpProfile': 'FTP_FILE_EXPLORER',
      'sambaProfile': 'SAMBA_FILE_EXPLORER',
      'customProfile': 'CUSTOM',
    };

    // Check for old format (direct properties) and migrate
    for (const [oldKey, newKey] of Object.entries(oldFieldMap)) {
      if (data[oldKey] !== undefined && data[oldKey] !== null) {
        profile.profileData.set(newKey, data[oldKey]);
      }
    }

    // Handle new format (profileData already present)
    if (data.profileData && typeof data.profileData === 'object') {
      if (data.profileData instanceof Map) {
        data.profileData.forEach((value: any, key: string) => {
          profile.profileData.set(key, value);
        });
      } else {
        Object.entries(data.profileData).forEach(([key, value]) => {
          profile.profileData.set(key, value);
        });
      }
    }

    return profile;
  }

  static requireOpenNewTab(profile: Profile) {
    return !['RDP_REMOTE_DESKTOP', 'CUSTOM']
      .includes(profile.profileType);
  }

  static useSecret(one: Profile, secret: any) {
    for (const [, profileData] of one.profileData) {
      if (profileData?.secretId == secret?.id) return true;
    }
    return false;
  }

  static clearSecret(one: Profile, secret: any) {
    for (const [, profileData] of one.profileData) {
      if (profileData?.secretId == secret.id) {
        profileData.secretId = '';
      }
    }
  }
}
