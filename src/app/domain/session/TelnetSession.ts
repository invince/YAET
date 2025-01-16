import {Profile, ProfileType} from '../profile/Profile';
import {TabService} from '../../services/tab.service';
import {ElectronService} from '../../services/electron.service';
import {Session} from './Session';

export class TelnetSession extends Session {

  constructor(profile: Profile, profileType: ProfileType,
              tabService: TabService,
              private electron: ElectronService
  ) {
    super(profile, profileType, tabService);
  }

  override close(): void {
    this.electron.closeTelnetTerminalSession(this);
    super.close();
  }

  override open(): void {
    this.electron.openTelnetTerminalSession(this);
    super.open();
  }
}
