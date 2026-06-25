import {ScpService} from '../services/scp.service';
import {TabService} from '../../../../src/app/services/tab.service';
import {Profile} from '../../../../src/app/domain/profile/Profile';
import {Session} from '../../../../src/app/domain/session/Session';

export class ScpSession extends Session {

  constructor(profile: Profile, profileType: string,
    tabService: TabService,
    private scpService: ScpService,
  ) {
    super(profile, profileType, tabService);
  }


  override close(): void {
    super.close();
  }

  override open(): void {
    this.scpService.connect(this.id, this.profile.getProfile('SSH_TERMINAL'), this.profile.proxyId).then(
      () => this.tabService.connected(this.id)
    );
    super.open();
  }

}
