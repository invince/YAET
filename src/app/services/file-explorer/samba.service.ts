import {Injectable} from '@angular/core';
import {ElectronFileExplorerService} from '../electron/electron-file-explorer.service';
import {SambaProfile} from '../../domain/profile/SambaProfile';
import {NODE_EXPRESS_API_ROOT} from '../electron/ElectronConstant';
import {AbstractFileExplorerService} from './AbstractFileExplorerService';

@Injectable({
  providedIn: 'root'
})
export class SambaService extends AbstractFileExplorerService{

  constructor(private electron: ElectronFileExplorerService) {
    super();
  }

  apiUrl() {
    return NODE_EXPRESS_API_ROOT + '/v1/samba';
  }

  async connect(id:string , sambaProfile: SambaProfile) {
    return this.electron.registerSambaSession(id , sambaProfile);
  }

}
