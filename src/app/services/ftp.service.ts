import { Injectable } from '@angular/core';
import {Session} from '../domain/session/Session';
import {FTPProfile} from '../domain/profile/FTPProfile';
import {ElectronFileExplorerService} from './electron/electron-file-explorer.service';

@Injectable({
  providedIn: 'root'
})
export class FtpService {

  private apiUrl = 'http://localhost:13012/api/v1/ftp';

  constructor(private electron: ElectronFileExplorerService) { }

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
