import {HasLoginProfile} from './HasLoginProfile';

export class AbstractRemoteConnectionProfile extends HasLoginProfile{
  public host: string = '';
  public port: number = 0;
}
