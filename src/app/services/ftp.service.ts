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
      url: this.apiUrl + '/' + session.id, // Custom backend API
      uploadUrl: this.apiUrl + '/upload/' + session.id , // Custom upload endpoint
      downloadUrl: this.apiUrl + '/download/' + session.id, // Custom download endpoint
      openUrl: this.apiUrl + '/open/' + session.id, // Custom download endpoint
    };
  }
}
