import {AbstractRemoteConnectionProfile} from './AbstractRemoteConnectionProfile';

export class RemoteTerminalProfile extends AbstractRemoteConnectionProfile{
  public initCmd?: string;
  public initPath?: string;

  constructor(port: number = 22) {
    super();
    this.port = port;
  }

}
