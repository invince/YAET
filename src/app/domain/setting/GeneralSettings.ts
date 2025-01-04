import {Group} from '../Group';
import {Tag} from '../Tag';

export class GeneralSettings {

  autoUpdate: boolean = true;

  public groups: Group[];
  public tags: Tag[];

  constructor() {

    this.groups = [];
    this.tags = [];

  }
}

