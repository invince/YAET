import {Profile, ProfileType} from '../profile/Profile';
import {TabService} from '../../services/tab.service';
import {Session} from './Session';

export class TelnetSession extends Session {

  private telnetService: any;

  constructor(profile: Profile, profileType: ProfileType,
              tabService: TabService,
              telnetService: any,
  ) {
    super(profile, profileType, tabService);
    this.telnetService = telnetService;
  }

  override close(): void {
    this.telnetService.closeTelnetTerminalSession(this);
    super.close();
  }

  override open(): void {
    this.telnetService.openTelnetTerminalSession(this);
    super.open();
  }
}
