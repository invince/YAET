import {Session} from '../../domain/session/Session';


export abstract class AbstractFileExplorerService {

  protected abstract apiUrl(): string;

  setup(session: Session) {
    return {
      url: this.apiUrl() + '/' + session.id, // Action api
      uploadUrl: this.apiUrl() + '/upload/' + session.id ,
      downloadUrl: this.apiUrl() + '/download/' + session.id,
      openUrl: this.apiUrl() + '/open/' + session.id,
    };
  }
}
