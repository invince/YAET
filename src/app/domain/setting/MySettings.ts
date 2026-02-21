import {Group} from '../Group';
import {Tag} from '../Tag';
import {AiSettings} from './AiSettings';
import {FileExplorerSettings} from './FileExplorerSettings';
import {GeneralSettings} from './GeneralSettings';
import {RemoteDesktopSettings} from './RemoteDesktopSettings';
import {TerminalSettings} from './TerminalSettings';
import {UISettings} from './UISettings';

export class MySettings {

  revision: number;
  public general!: GeneralSettings;
  public ui!: UISettings;
  public groups: Group[];
  public tags: Tag[];

  public terminal: TerminalSettings;
  public fileExplorer: FileExplorerSettings;
  public remoteDesktop: RemoteDesktopSettings;
  public ai: AiSettings;

  public isNew: boolean = true;

  public version: string = '';
  public compatibleVersion: string = '';

  constructor() {
    this.revision = Date.now();
    this.general = new GeneralSettings();
    this.ui = new UISettings();
    this.terminal = new TerminalSettings();
    this.fileExplorer = new FileExplorerSettings();
    this.remoteDesktop = new RemoteDesktopSettings();
    this.ai = new AiSettings();
    this.groups = [];
    this.tags = [];
  }

}
