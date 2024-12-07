import {Profile, ProfileCategory, ProfileType} from './Profile';
import {NgTerminalComponent} from 'ng-terminal';


export class TabInstance {

  readonly id: string; // uuid

  public name!: string;
  readonly tabType: ProfileType;
  readonly category: ProfileCategory;

  profile: Profile;

  public terminal!: NgTerminalComponent;
  public content: string[] = [];


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


}
