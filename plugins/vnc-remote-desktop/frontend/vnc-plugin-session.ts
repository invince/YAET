import {ElementRef} from '@angular/core';
import {Profile, ProfileType} from '../../../src/app/domain/profile/Profile';
import {Session} from '../../../src/app/domain/session/Session';
import {TabService} from '../../../src/app/services/tab.service';
import {VncService} from './services/vnc.service';
import {NgxSpinnerService} from 'ngx-spinner';
import {NotificationService} from '../../../src/app/services/notification.service';

export class VncPluginSession extends Session {

  constructor(profile: Profile, profileType: ProfileType,
              tabService: TabService,
              private vncService: VncService,
              private spinner: NgxSpinnerService,
              private notification: NotificationService,
  ) {
    super(profile, profileType, tabService);
  }

  override close(): void {
    this.vncService.disconnect(this.id);
    super.close();
  }

  override open(vncContainer: ElementRef): void {
    this.spinner.show();
    this.vncService.connect(this.id, this.profile?.vncProfile, vncContainer)
      .then(
        () => {
          this.spinner.hide();
          this.tabService.connected(this.id);
        }
      ).catch(
      err => {
        this.spinner.hide();
        this.notification.error('ERROR: ' + err.message);
      }
    );
    super.open();
  }
}
