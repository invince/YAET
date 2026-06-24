import {AbstractRemoteConnectionProfile} from '../../../../src/app/domain/profile/AbstractRemoteConnectionProfile';

export class VncProfile extends AbstractRemoteConnectionProfile {

  constructor() {
    super();
    this.port = 5900;
  }

}
