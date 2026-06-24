import {Session} from './Session';
import {Profile} from '../profile/Profile';
import {TabService} from '../../services/tab.service';
import {SambaService} from '../../services/file-explorer/samba.service';

export class SambaSession extends Session {

  constructor(profile: Profile, profileType: string,
              tabService: TabService,
              private sambaService: SambaService,
  ) {
    super(profile, profileType, tabService);
  }


  override close(): void {
    super.close();
  }

  override open(): void {
    this.sambaService.connect(this.id, this.profile.getProfile('SAMBA_FILE_EXPLORER')).then(
      () => this.tabService.connected(this.id)
    );
    super.open();
  }

}
