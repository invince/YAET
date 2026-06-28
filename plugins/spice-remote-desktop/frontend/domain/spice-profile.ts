import {AbstractRemoteConnectionProfile} from '../../../../src/app/domain/profile/AbstractRemoteConnectionProfile';

export class SpiceProfile extends AbstractRemoteConnectionProfile {

  public tls: boolean = false;

  constructor() {
    super();
    this.port = 5900;
  }

}
