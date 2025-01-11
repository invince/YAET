import {ProfileCategory} from './profile/Profile';
import {Session} from './session/Session';

export class TabInstance {

  readonly id: string; // uuid

  public name!: string;
  readonly category: ProfileCategory;

  public connected: boolean = false;


  session: Session;


  constructor(category: ProfileCategory, session: Session) {
    this.session = session;
    this.id = session.id;
    this.category = category;
    this.name = this.session.profile?.name;
    if (!this.name) {
      this.name = this.session.profileType;
    }
  }

}
