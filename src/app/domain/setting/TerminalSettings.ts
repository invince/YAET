import {LocalTerminalProfile, LocalTerminalType} from '../profile/LocalTerminalProfile';

export class TerminalSettings {
  public localTerminal!: LocalTerminalProfile;

  constructor() {
    this.localTerminal = new LocalTerminalProfile();
  }

  get localTerminalType(): LocalTerminalType {
    return this.localTerminal?.type;
  }

  set localTerminalType(value: LocalTerminalType) {
    this.localTerminal.type = value;
  }
}
