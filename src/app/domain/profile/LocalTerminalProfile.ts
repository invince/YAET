export enum LocalTerminalType {
  CMD = 'cmd',
  POWERSHELL = 'powershell', // powershell.exe
  POWERSHELL_7 = 'powershell 7', // pwsh.exe

  BASH = 'bash',
  CUSTOM = 'custom'
}

export class LocalTerminalProfile {
  public type!: LocalTerminalType
  public execPath!: string;

  public defaultOpen: boolean = false;
}
