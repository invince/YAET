import {Profile, ProfileCategory, ProfileType} from './Profile';


export class TabInstance {

  readonly id: string; // uuid

  readonly tabType: ProfileType;
  readonly category: ProfileCategory;

  profile: Profile;


  constructor(id: string, category: ProfileCategory, type: ProfileType, profile: Profile) {
    this.id = id;
    this.tabType = type;
    this.category = category;
    this.profile = profile;
  }


}
