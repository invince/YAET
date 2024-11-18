import {LocalTerminalProfile} from './LocalTerminalProfile';
import {v4 as uuidv4} from 'uuid';

export enum ProfileCategory {
  TERMINAL = 'TERMINAL',
  REMOTE_DESKTOP = 'REMOTE_DESKTOP',
  FILE_EXPLORER = 'FILE_EXPLORER'
}

export class Profile {

  readonly id: string = uuidv4(); // uuid
  public name: string = '';

  public comment:String = '';

  public category!: ProfileCategory;
  public localTerminal!: LocalTerminalProfile;


  constructor() {
    this.localTerminal = new LocalTerminalProfile();
  }
}
