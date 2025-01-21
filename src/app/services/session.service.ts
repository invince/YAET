import {Injectable} from '@angular/core';
import {Profile, ProfileType} from '../domain/profile/Profile';
import {Session} from '../domain/session/Session';
import {SSHSession} from '../domain/session/SSHSession';
import {TabService} from './tab.service';
import {LocalTerminalSession} from '../domain/session/LocalTerminalSession';
import {VncSession} from '../domain/session/VncSession';
import {NgxSpinnerService} from 'ngx-spinner';
import {VncService} from './remote-desktop/vnc.service';
import {ScpSession} from '../domain/session/ScpSession';
import {ScpService} from './file-explorer/scp.service';
import {NotificationService} from './notification.service';
import {TabInstance} from '../domain/TabInstance';
import {FtpSession} from '../domain/session/FtpSession';
import {FtpService} from './file-explorer/ftp.service';
import {TelnetSession} from '../domain/session/TelnetSession';
import {ElectronTerminalService} from './electron/electron-terminal.service';
import {ElectronRemoteDesktopService} from './electron/electron-remote-desktop.service';
import {WinRMSession} from '../domain/session/WinRMSession';
import {SambaSession} from '../domain/session/SambaSession';
import {SambaService} from './file-explorer/samba.service';

@Injectable({
  providedIn: 'root'
})
export class SessionService {

  constructor(
    private tabService: TabService,
    private spinner: NgxSpinnerService,
    private notification: NotificationService,

    private electronTerm: ElectronTerminalService,
    private electronRD: ElectronRemoteDesktopService,
    private vncService: VncService,

    private scpService: ScpService,
    private ftpService: FtpService,
    private sambaService: SambaService,
  ) { }


  create(profile: Profile, profileType: ProfileType): Session {
    switch (profileType) {
      case ProfileType.LOCAL_TERMINAL:
        return new LocalTerminalSession(profile, profileType, this.tabService, this.electronTerm);
      case ProfileType.SSH_TERMINAL:
        return new SSHSession(profile, profileType, this.tabService, this.electronTerm);
      case ProfileType.TELNET_TERMINAL:
        return new TelnetSession(profile, profileType, this.tabService, this.electronTerm);
      case ProfileType.WIN_RM_TERMINAL:
        return new WinRMSession(profile, profileType, this.tabService, this.electronTerm);

      case ProfileType.VNC_REMOTE_DESKTOP:
        return new VncSession(profile, profileType, this.tabService, this.vncService, this.spinner, this.notification);
      case ProfileType.SAMBA_FILE_EXPLORER:
        return new SambaSession(profile, profileType, this.tabService, this.sambaService)

      case ProfileType.SCP_FILE_EXPLORER:
        return new ScpSession(profile, profileType, this.tabService, this.scpService);
      case ProfileType.FTP_FILE_EXPLORER:
        return new FtpSession(profile, profileType, this.tabService, this.ftpService);
    }

    return new Session(profile, profileType, this.tabService);
  }

  openSessionWithoutTab(profile: Profile) {
    if (profile) {
      switch (profile.profileType) {
        case ProfileType.RDP_REMOTE_DESKTOP:
          if (!profile.rdpProfile || !profile.rdpProfile.host) {
            this.notification.error('Invalid Rdp Config');
            return;
          }
          this.electronRD.openRdpSession(profile.rdpProfile);
          break;
        case ProfileType.CUSTOM:
          if (!profile.customProfile || !profile.customProfile.execPath) {
            this.notification.error('Invalid Custom Profile');
            return;
          }
          this.electronTerm.openCustomSession(profile.customProfile);
          break;
      }
    }
  }

  reconnect(i: number) {
    if(this.tabService.tabs) {
      let oldTab = this.tabService.tabs[i];
      let oldSession = oldTab.session;
      let newSession = this.create(oldSession.profile, oldSession.profileType);
      let newTab =  new TabInstance(oldTab.category, newSession);
      newTab.name = oldTab.name;
      this.tabService.tabs[i] = newTab;
    }
  }
}
