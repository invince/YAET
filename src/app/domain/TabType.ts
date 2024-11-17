export class TabType {
  constructor(private value: string) {
  }


  get(): string {
    return this.value;
  }
}

export const LOCAL_TERMINAL = new TabType("LOCAL_TERMINAL");
export const SSH_TERMINAL = new TabType("SSH_TERMINAL");
export const TELNET_TERMINAL = new TabType("TELNET_TERMINAL");
export const REAL_VNC_REMOTE_DESKTOP = new TabType("REAL_VNC_REMOTE_DESKTOP");
export const TIGHT_VNC_REMOTE_DESKTOP = new TabType("TIGHT_VNC_REMOTE_DESKTOP");
export const RDP_REMOTE_DESKTOP = new TabType("RDP_REMOTE_DESKTOP");
export const SCP_FILE_EXPLORER = new TabType("SCP_FILE_EXPLORER");
export const SFTP_FILE_EXPLORER = new TabType("SFTP_FILE_EXPLORER");
