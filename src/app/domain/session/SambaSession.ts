import {Session} from './Session';
import {Profile, ProfileType} from '../profile/Profile';
import {ElectronService} from '../../services/electron/electron.service';
import {TabService} from '../../services/tab.service';
import {ScpService} from '../../services/scp.service';
import {FtpService} from '../../services/ftp.service';
import {SambaService} from '../../services/samba.service';

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
