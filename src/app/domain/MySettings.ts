import {LocalTerminalProfile} from './LocalTerminalProfile';
import {UISettings} from './UISettings';
import {Tag} from './Tag';
import {Group} from './Group';
import {GeneralSettings} from './GeneralSettings';

export class MySettings {

  public general!: GeneralSettings;
  public ui!: UISettings;
  public groups: Group[];
  public tags: Tag[];
  public localTerminal!: LocalTerminalProfile;


  constructor() {
    this.localTerminal = new LocalTerminalProfile();
    this.ui = new UISettings();
    this.groups = [];
    this.tags = [];
  }

}

