import {Profile, ProfileType} from '../profile/Profile';
import {TabService} from '../../services/tab.service';
import {Session} from './Session';
import {ElectronTerminalService} from '../../services/electron/electron-terminal.service';

export class SSHSession extends Session {

  constructor(profile: Profile, profileType: ProfileType,
              tabService: TabService,
              private electron: ElectronTerminalService
  ) {
    super(profile, profileType, tabService);
  }

  override close(): void {
    this.electron.closeSSHTerminalSession(this);
    super.close();
  }

  override open(): void {
    this.electron.openSSHTerminalSession(this);
    super.open();
  }
}
