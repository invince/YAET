import {AbstractRemoteConnectionProfile} from './AbstractRemoteConnectionProfile';

export class VncProfile extends AbstractRemoteConnectionProfile{

  constructor() {
    super();
    this.port = 5900;
  }

}
