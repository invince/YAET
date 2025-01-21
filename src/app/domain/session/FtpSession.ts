import {Session} from './Session';
import {Profile, ProfileType} from '../profile/Profile';
import {TabService} from '../../services/tab.service';
import {FtpService} from '../../services/file-explorer/ftp.service';

export class FtpSession extends Session {

  constructor(profile: Profile, profileType: ProfileType,
              tabService: TabService,
              private ftpService: FtpService,
  ) {
    super(profile, profileType, tabService);
  }


  override close(): void {
    super.close();
  }

  override open(): void {
    this.ftpService.connect(this.id, this.profile.ftpProfile).then(
      () => this.tabService.connected(this.id)
    );
    super.open();
  }

}
