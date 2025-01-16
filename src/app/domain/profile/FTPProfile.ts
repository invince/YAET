import {AbstractRemoteConnectionProfile} from './AbstractRemoteConnectionProfile';

export class FTPProfile extends AbstractRemoteConnectionProfile {
  public secured: boolean = false;
  public initPath?: string;

  constructor() {
    super();
    this.port = 21;
  }

}
