import {Session} from './Session';
import {Profile, ProfileType} from '../profile/Profile';
import {ElectronService} from '../../services/electron.service';
import {TabService} from '../../services/tab.service';

export class TerminalSession extends Session {

  constructor(profile: Profile, profileType: ProfileType,
              tabService: TabService,
              private electron: ElectronService
  ) {
    super(profile, profileType, tabService);
  }


  override close(): void {
    this.electron.closeTerminalSession(this);
    super.close();
  }

  override open(): void {
    this.electron.openTerminalSession(this);
    super.open();
  }

}
