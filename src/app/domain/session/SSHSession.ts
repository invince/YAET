import {Profile, ProfileType} from '../profile/Profile';
import {TabService} from '../../services/tab.service';
import {Session} from './Session';

/**
 * SSH Session — thin wrapper that delegates to a pluggable SSH service.
 *
 * The sshService is injected via constructor so the plugin can provide
 * its own implementation without the core knowing about the plugin.
 */
export class SSHSession extends Session {

  private sshService: any;

  constructor(profile: Profile, profileType: ProfileType,
              tabService: TabService,
              sshService: any
  ) {
    super(profile, profileType, tabService);
    this.sshService = sshService;
  }

  override close(): void {
    this.sshService.closeSSHTerminalSession(this);
    super.close();
  }

  override open(): void {
    this.sshService.openSSHTerminalSession(this);
    super.open();
  }
}
