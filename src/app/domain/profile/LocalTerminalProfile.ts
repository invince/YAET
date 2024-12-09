export enum LocalTerminalType {
  CMD = 'cmd',
  POWERSHELL = 'powershell', // powershell.exe
  // WIN_TERMINAL = 'window terminal', //wt.exe

  BASH = 'bash',
  CUSTOM = 'custom'
}

export class LocalTerminalProfile {
  public type!: LocalTerminalType
  public execPath!: string;

}
