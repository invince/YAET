import {Profile} from './Profile';

export enum LocalTerminalType {
  CMD,
  POWERSHELL, // powershell.exe
  WIN_TERMINAL, //wt.exe
  CUSTOM
}

export class LocalTerminalProfile {
  public type!: LocalTerminalType
  public execPath!: string;

}
