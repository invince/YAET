import {Session} from './Session';
import {Profile} from '../profile/Profile';
import {TabService} from '../../services/tab.service';
import {FtpService} from '../../services/file-explorer/ftp.service';

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
