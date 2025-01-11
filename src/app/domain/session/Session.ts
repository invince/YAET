import {Profile, ProfileType} from '../profile/Profile';
import {v4 as uuidv4} from 'uuid';
import {TabService} from '../../services/tab.service';

export class Session {
  readonly id: string = uuidv4(); // uuid
  constructor(public profile: Profile, public profileType: ProfileType, protected tabService: TabService) {
  }

  open(...args: any): void {
    this.tabService.connected(this.id);
  };

  close(...args: any): void {
    this.tabService.disconnected(this.id);
  };

  clone(): Session {
    return new Session(this.profile, this.profileType, this.tabService);
  }
}
