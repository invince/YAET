import {AbstractRemoteConnectionProfile} from './AbstractRemoteConnectionProfile';
import {AuthType} from '../Secret';

export class RdpProfile extends AbstractRemoteConnectionProfile {
  public domain: string = '';
  public fullScreen: boolean = false;
  public asAdmin: boolean = false;

  constructor() {
    super();
    this.port = 3389;
    this.authType = AuthType.LOGIN;
  }
}
