import {AbstractRemoteConnectionProfile} from './AbstractRemoteConnectionProfile';
import {TunnelRule} from './TunnelRule';

export class RemoteTerminalProfile extends AbstractRemoteConnectionProfile{
  public initCmd?: string;
  public initPath?: string;

  /** SSH port-forwarding rules (A1). Only honored for SSH_TERMINAL profiles. */
  public tunnels?: TunnelRule[];

  constructor(port: number = 22) {
    super();
    this.port = port;
  }

}
