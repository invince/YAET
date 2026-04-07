import {inject} from '@angular/core';
import {Session} from '../../domain/session/Session';
import {BackendConfigService} from '../electron/backend-config.service';


export abstract class AbstractFileExplorerService {

  protected backendConfig = inject(BackendConfigService);

  protected abstract apiPath(): string;

  protected apiUrl(): string {
    return this.backendConfig.apiRoot + this.apiPath();
  }

  get authorizationHeader(): string {
    return this.backendConfig.authorizationHeader;
  }

  setup(session: Session) {
    return {
      url: this.apiUrl() + '/' + session.id,
      uploadUrl: this.apiUrl() + '/upload/' + session.id,
      downloadUrl: this.apiUrl() + '/download/' + session.id,
      openUrl: this.apiUrl() + '/open/' + session.id,
      authorizationHeader: this.authorizationHeader,
    };
  }
}

