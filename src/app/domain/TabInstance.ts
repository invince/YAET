import {Profile} from './Profile';
import {TabType} from './TabType';
import {TabCategory} from './TabCategory';

export class TabInstance {

  readonly id: number;

  readonly tabType: TabType;
  readonly category: TabCategory;

  profile: Profile;


  constructor(id: number, category: TabCategory,  type: TabType, profile: Profile) {
    this.id = id;
    this.tabType = type;
    this.category = category;
    this.profile = profile;
  }


}
