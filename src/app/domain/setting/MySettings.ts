import {UISettings} from './UISettings';
import {GeneralSettings} from './GeneralSettings';
import {RemoteDesktopSettings} from './RemoteDesktopSettings';
import {FileExplorerSettings} from './FileExplorerSettings';
import {TerminalSettings} from './TerminalSettings';
import {Group} from '../Group';
import {Tag} from '../Tag';

export class MySettings {

  revision: number;
  public general!: GeneralSettings;
  public ui!: UISettings;
  public groups: Group[];
  public tags: Tag[];

  public terminal: TerminalSettings;
  public fileExplorer: FileExplorerSettings;
  public remoteDesk: RemoteDesktopSettings;

  public isNew: boolean = true;

  public version: string = '';

  constructor() {
    this.revision = Date.now();
    this.general = new GeneralSettings();
    this.ui = new UISettings();
    this.terminal = new TerminalSettings();
    this.fileExplorer = new FileExplorerSettings();
    this.remoteDesk = new RemoteDesktopSettings();
    this.groups = [];
    this.tags = [];
  }

}

