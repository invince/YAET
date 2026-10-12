import {Profile} from '../profile/Profile';
import {v4 as uuidv4} from 'uuid';
import {TabService} from '../../services/tab.service';

export class Session {
  readonly id: string = uuidv4(); // uuid
  /**
   * Terminal geometry captured by the UI right before open().
   * Plugin sessions forward it in the open payload so the backend can
   * size the pty correctly from the start (no resize race).
   */
  pendingTerminalSize?: { cols: number; rows: number };
  constructor(public profile: Profile, public profileType: string, protected tabService: TabService) {
  }

  open(...args: any): void {
    this.tabService.connected(this.id);
  };

  close(...args: any): void {
    this.tabService.disconnected(this.id);
  };

  clone(): Session {
    return new Session(this.profile, this.profileType, this.tabService);
  }
}
