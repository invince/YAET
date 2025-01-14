import { Injectable } from '@angular/core';
import {ElectronService} from './electron.service';
import {SSHProfile} from '../domain/profile/SSHProfile';
import {Session} from '../domain/session/Session';
import {FTPProfile} from '../domain/profile/FTPProfile';

@Injectable({
  providedIn: 'root'
})
export class FtpService {

  private apiUrl = 'http://localhost:13012/api/v1/ftp';

  constructor(private electron: ElectronService) { }

  async connect(id:string , ftpProfile: FTPProfile) {
    return this.electron.registerFtpSession(id , ftpProfile);
  }

  setup(session: Session) {
    return {
      url: this.apiUrl + '/' + session.id, // Action api
      uploadUrl: this.apiUrl + '/upload/' + session.id ,
      downloadUrl: this.apiUrl + '/download/' + session.id,
      openUrl: this.apiUrl + '/open/' + session.id,
    };
  }
}
