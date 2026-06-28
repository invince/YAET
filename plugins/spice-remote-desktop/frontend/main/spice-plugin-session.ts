import {ElementRef} from '@angular/core';
import {Profile} from '../../../../src/app/domain/profile/Profile';
import {Session} from '../../../../src/app/domain/session/Session';
import {TabService} from '../../../../src/app/services/tab.service';
import {SpiceService} from '../services/spice.service';
import {NgxSpinnerService} from 'ngx-spinner';
import {NotificationService} from '../../../../src/app/services/notification.service';

export class SpicePluginSession extends Session {

  constructor(profile: Profile, profileType: string,
              tabService: TabService,
              private spiceService: SpiceService,
              private spinner: NgxSpinnerService,
              private notification: NotificationService,
  ) {
    super(profile, profileType, tabService);
  }

  override close(): void {
    this.spiceService.disconnect(this.id);
    super.close();
  }

  override open(spiceContainer: ElementRef): void {
    this.spinner.show();
    this.spiceService.connect(this.id, this.profile?.getProfile('SPICE_REMOTE_DESKTOP'), spiceContainer)
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
