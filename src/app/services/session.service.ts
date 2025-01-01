import { Injectable } from '@angular/core';
import {Profile, ProfileType} from '../domain/profile/Profile';
import {Session} from '../domain/session/Session';
import {SSHSession} from '../domain/session/SSHSession';
import {ElectronService} from './electron.service';
import {TabService} from './tab.service';
import {LocalTerminalSession} from '../domain/session/LocalTerminalSession';
import {VncSession} from '../domain/session/VncSession';
import {NgxSpinnerService} from 'ngx-spinner';
import {MatSnackBar} from '@angular/material/snack-bar';
import {VncService} from './vnc.service';
import {ScpSession} from '../domain/session/ScpSession';
import {ScpService} from './scp.service';

@Injectable({
  providedIn: 'root'
})
export class SessionService {

  constructor(
    private tabService: TabService,
    private electron: ElectronService,
    private vncService: VncService,

    private scpService: ScpService,
    private spinner: NgxSpinnerService,
    private _snackBar: MatSnackBar,
  ) { }


  create(profile: Profile, profileType: ProfileType): Session {
    switch (profileType) {
      case ProfileType.LOCAL_TERMINAL:
        return new LocalTerminalSession(profile, profileType, this.tabService, this.electron);
      case ProfileType.SSH_TERMINAL:
        return new SSHSession(profile, profileType, this.tabService, this.electron);
      case ProfileType.VNC_REMOTE_DESKTOP:
        return new VncSession(profile, profileType, this.tabService, this.vncService, this.spinner, this._snackBar);

      case ProfileType.SCP_FILE_EXPLORER:
        return new ScpSession(profile, profileType, this.tabService, this.scpService);

    }

    return new Session(profile, profileType, this.tabService);
  }

  openSessionWithoutTab(profile: Profile) {
    if (profile) {
      switch (profile.profileType) {
        case ProfileType.RDP_REMOTE_DESKTOP:
          if (!profile.rdpProfile || !profile.rdpProfile.host) {
            this._snackBar.open('Invalid Rdp Config', 'OK', {
              duration: 3000,
              panelClass: [ 'error-snackbar']
            });
            return;
          }
          this.electron.openRdpSession(profile.rdpProfile);
          break;
        case ProfileType.CUSTOM:
          if (!profile.customProfile || !profile.customProfile.execPath) {
            this._snackBar.open('Invalid Custom Profile', 'OK', {
              duration: 3000,
              panelClass: [ 'error-snackbar']
            });
            return;
          }
          this.electron.openCustomSession(profile.customProfile);
          break;
      }
    }
  }
}
