import { Injectable } from '@angular/core';
import {ElectronService} from './electron.service';
import {SSHProfile} from '../domain/profile/SSHProfile';
import {Session} from '../domain/session/Session';

@Injectable({
  providedIn: 'root'
})
export class ScpService {

  private apiUrl = 'http://localhost:13012/api/v1/scp';

  constructor(private electron: ElectronService) { }

  async connect(id:string , sshProfile: SSHProfile) {
    return this.electron.registerScpSession(id , sshProfile);
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
