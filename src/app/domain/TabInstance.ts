import {Profile, ProfileCategory, ProfileType} from './profile/Profile';

export class TabInstance {

  readonly id: string; // uuid

  public name!: string;
  readonly tabType: ProfileType;
  readonly category: ProfileCategory;

  public connected: boolean = false;

  profile: Profile;


  constructor(id: string, category: ProfileCategory, type: ProfileType, profile: Profile) {
    this.id = id;
    this.tabType = type;
    this.category = category;
    this.profile = profile;
    this.name = this.profile?.name;
    if (!this.name) {
      this.name = type;
    }
  }


  clone() {
    let tab = new TabInstance(this.id, this.category, this.tabType, this.profile);
    tab.name = this.name;
    return tab;
  }
}
