import {Session} from '../../../../src/app/domain/session/Session';
import {Profile} from '../../../../src/app/domain/profile/Profile';
import {TabService} from '../../../../src/app/services/tab.service';
import {SambaService} from '../services/samba.service';

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