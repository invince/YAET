import {Session} from './Session';
import {Profile, ProfileType} from '../profile/Profile';
import {ElectronService} from '../../services/electron.service';
import {TabService} from '../../services/tab.service';
import {ScpService} from '../../services/scp.service';

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
    this.scpService.connect(this.id, this.profile.sshProfile).then(
      () => this.tabService.connected(this.id)
    );
    super.open();
  }

}
