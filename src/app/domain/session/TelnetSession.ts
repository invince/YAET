import {Profile} from '../profile/Profile';
import {TabService} from '../../services/tab.service';
import {Session} from './Session';

export class TelnetSession extends Session {

  private telnetService: any;

  constructor(profile: Profile, profileType: string,
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
