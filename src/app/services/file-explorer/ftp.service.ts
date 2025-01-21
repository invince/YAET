import {Injectable} from '@angular/core';
import {FTPProfile} from '../../domain/profile/FTPProfile';
import {ElectronFileExplorerService} from '../electron/electron-file-explorer.service';
import {NODE_EXPRESS_API_ROOT} from '../electron/ElectronConstant';
import {AbstractFileExplorerService} from './AbstractFileExplorerService';

@Injectable({
  providedIn: 'root'
})
export class FtpService extends AbstractFileExplorerService {

  constructor(private electron: ElectronFileExplorerService) {
    super();
  }

  apiUrl() {
    return NODE_EXPRESS_API_ROOT + '/v1/ftp';
  }

  async connect(id:string , ftpProfile: FTPProfile) {
    return this.electron.registerFtpSession(id , ftpProfile);
  }

}
