import { Injectable } from '@angular/core';
import { RemoteTerminalProfile } from '../../domain/profile/RemoteTerminalProfile';
import { ElectronFileExplorerService } from '../electron/electron-file-explorer.service';
import { NODE_EXPRESS_API_ROOT } from '../electron/ElectronConstant';
import { AbstractFileExplorerService } from './AbstractFileExplorerService';

@Injectable({
  providedIn: 'root'
})
export class ScpService extends AbstractFileExplorerService {

  constructor(private electron: ElectronFileExplorerService) {
    super();
  }

  apiUrl() {
    return NODE_EXPRESS_API_ROOT + '/v1/scp';
  }

  async connect(id: string, sshProfile: RemoteTerminalProfile, proxyId?: string) {
    return this.electron.registerScpSession(id, sshProfile, proxyId);
  }

}
