import {LocalTerminalProfile} from './LocalTerminalProfile';

export class MySettings {

  public localTerminalSetting!: LocalTerminalProfile;

  constructor() {
    this.localTerminalSetting = new LocalTerminalProfile();
  }

}
