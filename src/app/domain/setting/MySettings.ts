import {LocalTerminalProfile} from '../profile/LocalTerminalProfile';
import {UISettings} from './UISettings';
import {Tag} from '../Tag';
import {Group} from '../Group';
import {GeneralSettings} from './GeneralSettings';

export class MySettings {

  revision: number;
  public general!: GeneralSettings;
  public ui!: UISettings;
  public groups: Group[];
  public tags: Tag[];
  public localTerminal!: LocalTerminalProfile;

  public isNew: boolean = true;

  constructor() {
    this.general = new GeneralSettings();
    this.localTerminal = new LocalTerminalProfile();
    this.ui = new UISettings();
    this.groups = [];
    this.tags = [];
    this.revision = Date.now();
  }

}

