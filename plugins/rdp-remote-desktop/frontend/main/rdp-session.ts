import {ElementRef} from '@angular/core';
import {Session} from '../../../../src/app/domain/session/Session';
import {Profile} from '../../../../src/app/domain/profile/Profile';
import {RdpProfile} from '../../../../src/app/domain/profile/RdpProfile';
import {TabService} from '../../../../src/app/services/tab.service';
import {RdpService} from '../services/rdp.service';
import {NgxSpinnerService} from 'ngx-spinner';
import {NotificationService} from '../../../../src/app/services/notification.service';

function platform(): string | undefined {
  return typeof window !== 'undefined' ? (window as any).electronAPI?.platform : undefined;
}

export class RdpSession extends Session {

  constructor(profile: Profile, profileType: string,
              tabService: TabService,
              private rdpService: RdpService,
              private spinner: NgxSpinnerService,
              private notification: NotificationService,
  ) {
    super(profile, profileType, tabService);
  }

  override open(canvasRef?: ElementRef<HTMLCanvasElement>): void {
    const rdpProfile = this.profile.getProfile('RDP_REMOTE_DESKTOP') as RdpProfile;
    if (!rdpProfile) {
      this.notification.error('Invalid RDP profile');
      return;
    }

    // Windows keeps launching the native mstsc client.
    if (platform() === 'win32') {
      const options = {fullscreen: rdpProfile.fullScreen, admin: rdpProfile.asAdmin};
      (window as any).electronAPI?.send('session.open.rd.rdp', {hostname: rdpProfile.host, options});
      super.open();
      return;
    }

    if (!canvasRef) {
      this.notification.error('RDP embedded session requires a canvas');
      return;
    }

    void this.spinner.show();
    this.rdpService.connect(this.id, rdpProfile, canvasRef)
      .then(() => {
        void this.spinner.hide();
        this.tabService.connected(this.id);
      })
      .catch(err => {
        void this.spinner.hide();
        this.notification.error('ERROR: ' + err.message);
      });
    super.open();
  }

  override close(): void {
    if (platform() !== 'win32') {
      this.rdpService.disconnect(this.id);
    }
    super.close();
  }
}
