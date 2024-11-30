import {LocalTerminalProfile} from './LocalTerminalProfile';
import {UISettings} from './UISettings';

export class MySettings {

  public localTerminal!: LocalTerminalProfile;

  public groups: string[];

  public ui!: UISettings;

  constructor() {
    this.localTerminal = new LocalTerminalProfile();
    this.ui = new UISettings();
    this.groups = [];
  }

}

