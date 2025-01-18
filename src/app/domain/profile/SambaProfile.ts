import {HasLoginProfile} from './HasLoginProfile';

export class SambaProfile extends HasLoginProfile{

  public share: string = '';
  public domain: string = '';
  public port: number = 445;

}
