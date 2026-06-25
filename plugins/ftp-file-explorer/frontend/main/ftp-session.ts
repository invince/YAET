import {Session} from '../../../../src/app/domain/session/Session';
import {Profile} from '../../../../src/app/domain/profile/Profile';
import {TabService} from '../../../../src/app/services/tab.service';
import {FtpService} from '../services/ftp.service';

export class FtpSession extends Session {

  constructor(profile: Profile, profileType: string,
              tabService: TabService,
              private ftpService: FtpService,
  ) {
    super(profile, profileType, tabService);
  }


  override close(): void {
    super.close();
  }

  override open(): void {
    this.ftpService.connect(this.id, this.profile.getProfile('FTP_FILE_EXPLORER')).then(
      () => this.tabService.connected(this.id)
    );
    super.open();
  }

}