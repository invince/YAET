import {LocalTerminalProfile} from '../profile/LocalTerminalProfile';

export class TerminalSettings {
  public localTerminal!: LocalTerminalProfile;

  constructor() {
    this.localTerminal = new LocalTerminalProfile();
  }
}
