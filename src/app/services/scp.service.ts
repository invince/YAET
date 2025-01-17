import { Injectable } from '@angular/core';
import {RemoteTerminalProfile} from '../domain/profile/RemoteTerminalProfile';
import {Session} from '../domain/session/Session';
import {ElectronFileExplorerService} from './electron/electron-file-explorer.service';

@Injectable({
  providedIn: 'root'
})
export class ScpService {

  private apiUrl = 'http://localhost:13012/api/v1/scp';

  constructor(private electron: ElectronFileExplorerService) { }

  async connect(id:string , sshProfile: RemoteTerminalProfile) {
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
