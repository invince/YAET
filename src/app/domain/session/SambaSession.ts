import {Session} from './Session';
import {Profile, ProfileType} from '../profile/Profile';
import {TabService} from '../../services/tab.service';
import {SambaService} from '../../services/file-explorer/samba.service';

export class SambaSession extends Session {

  constructor(profile: Profile, profileType: ProfileType,
              tabService: TabService,
              private sambaService: SambaService,
  ) {
    super(profile, profileType, tabService);
  }


  override close(): void {
    super.close();
  }

  override open(): void {
    this.sambaService.connect(this.id, this.profile.sambaProfile).then(
      () => this.tabService.connected(this.id)
    );
    super.open();
  }

}
