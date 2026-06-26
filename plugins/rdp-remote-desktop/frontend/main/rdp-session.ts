import {Session} from '../../../../src/app/domain/session/Session';
import {Profile} from '../../../../src/app/domain/profile/Profile';
import {TabService} from '../../../../src/app/services/tab.service';

export class RdpSession extends Session {

  constructor(profile: Profile, profileType: string,
              tabService: TabService,
  ) {
    super(profile, profileType, tabService);
  }

  override open(): void {
    const rdpProfile = this.profile.getProfile('RDP_REMOTE_DESKTOP');
    if (rdpProfile) {
      const hostname = rdpProfile.host;
      const options = {fullscreen: rdpProfile.fullScreen, admin: rdpProfile.asAdmin};
      (window as any).electronAPI?.send('session.open.rd.rdp', { hostname, options });
    }
    super.open();
  }

  override close(): void {
    super.close();
  }
}
