import {Injectable} from '@angular/core';
import {ElectronFileExplorerService} from '../../../../src/app/services/electron/electron-file-explorer.service';
import {SambaProfile} from '../../../../src/app/domain/profile/SambaProfile';
import {NODE_EXPRESS_API_ROOT} from '../../../../src/app/services/electron/ElectronConstant';
import {Session} from '../../../../src/app/domain/session/Session';

@Injectable({
  providedIn: 'root'
})
export class SambaService {

  constructor(private electron: ElectronFileExplorerService) {
  }

  apiUrl() {
    return NODE_EXPRESS_API_ROOT + '/v1/samba';
  }

  setup(session: Session) {
    const base = this.apiUrl();
    return {
      url: base + '/' + session.id,
      uploadUrl: base + '/upload/' + session.id,
      downloadUrl: base + '/download/' + session.id,
      openUrl: base + '/open/' + session.id,
    };
  }

  async connect(id: string, sambaProfile: SambaProfile) {
    return this.electron.registerSambaSession(id, sambaProfile);
  }

}