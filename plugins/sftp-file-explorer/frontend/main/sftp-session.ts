import {SftpService} from '../services/sftp.service';
import {TabService} from '../../../../src/app/services/tab.service';
import {Profile} from '../../../../src/app/domain/profile/Profile';
import {Session} from '../../../../src/app/domain/session/Session';

export class SftpSession extends Session {

  constructor(profile: Profile, profileType: string,
    tabService: TabService,
    private sftpService: SftpService,
  ) {
    super(profile, profileType, tabService);
  }


  override close(): void {
    super.close();
  }

  override open(): void {
    this.sftpService.connect(this.id, this.profile.getProfile('SSH_TERMINAL'), this.profile.proxyId).then(
      () => this.tabService.connected(this.id)
    );
    super.open();
  }

}
