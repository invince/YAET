import { ScpService } from '../../services/file-explorer/scp.service';
import { TabService } from '../../services/tab.service';
import { Profile, ProfileType } from '../profile/Profile';
import { Session } from './Session';

export class ScpSession extends Session {

  constructor(profile: Profile, profileType: ProfileType,
    tabService: TabService,
    private scpService: ScpService,
  ) {
    super(profile, profileType, tabService);
  }


  override close(): void {
    super.close();
  }

  override open(): void {
    this.scpService.connect(this.id, this.profile.sshProfile, this.profile.proxyId).then(
      () => this.tabService.connected(this.id)
    );
    super.open();
  }

}
