import {LocalTerminalProfile} from './LocalTerminalProfile';
import {UISettings} from './UISettings';
import {Tag} from './Tag';
import {Group} from './Group';

export class MySettings {

  public localTerminal!: LocalTerminalProfile;

  public groups: Group[];
  public tags: Tag[];

  public ui!: UISettings;

  constructor() {
    this.localTerminal = new LocalTerminalProfile();
    this.ui = new UISettings();
    this.groups = [];
    this.tags = [];
  }

}

