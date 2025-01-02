import {Session} from './Session';
import {Profile, ProfileType} from '../profile/Profile';
import {ElectronService} from '../../services/electron.service';
import {TabService} from '../../services/tab.service';
import {VncService} from '../../services/vnc.service';
import {ElementRef} from '@angular/core';
import {NgxSpinnerService} from 'ngx-spinner';
import {MatSnackBar} from '@angular/material/snack-bar';

export class VncSession extends Session {

  constructor(profile: Profile, profileType: ProfileType,
              tabService: TabService,
              private vncService: VncService,
              private spinner: NgxSpinnerService,
              private _snackBar: MatSnackBar,
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
        this._snackBar.open('ERROR: ' + err,'ok', {
          duration: 3000,
          panelClass: [ 'error-snackbar']
        });
      }
    );
    super.open();
  }

}
