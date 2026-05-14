import {Injectable} from '@angular/core';
import {Observable} from 'rxjs';
import {ElectronService} from './electron/electron.service';

@Injectable({
  providedIn: 'root'
})
export class AiService {

  constructor(
    private electronService: ElectronService,
  ) { }

  fetchModels(apiUrl: string, token: string): Observable<string[]> {
    return new Observable<string[]>(observer => {
      this.electronService.fetchAiModels(apiUrl, token).then(
        (models) => {
          observer.next(models);
          observer.complete();
        },
        (err) => {
          observer.error(err);
        }
      );
    });
  }

  fetchAcpModels(command: string, args: string): Observable<string[]> {
    return new Observable<string[]>(observer => {
      this.electronService.fetchAcpModels(command, args).then(
        (models) => {
          observer.next(models);
          observer.complete();
        },
        (err) => {
          observer.error(err);
        }
      );
    });
  }

  sendWebMessage(apiUrl: string, token: string, model: string, messages: any[]): Observable<any> {
    return new Observable<any>(observer => {
      this.electronService.sendAiChat(apiUrl, token, model, messages).then(
        (resp) => {
          observer.next(resp);
          observer.complete();
        },
        (err) => {
          observer.error(err);
        }
      );
    });
  }

  async sendAcpMessage(command: string, args: string, model: string, messages: any[]): Promise<string> {
    return this.electronService.sendAcpChat(command, args, model, messages);
  }

  extractWebContent(resp: any): string {
    return resp.choices?.[0]?.message?.content || '';
  }

  extractAcpContent(resp: any): string {
    if (typeof resp === 'string') return resp;
    return resp.content
      || resp.message?.content
      || resp.response
      || resp.result?.content
      || resp.result?.message?.content
      || '';
  }
}
