export enum LocalTerminalType {
  CMD = 'cmd',
  POWERSHELL = 'powershell', // powershell.exe

  // BASH = 'bash',
  // CUSTOM = 'custom'
}

export class LocalTerminalProfile {
  public type!: LocalTerminalType
  public execPath!: string;

  public defaultOpen: boolean = false;
}
