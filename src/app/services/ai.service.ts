import {HttpClient} from '@angular/common/http';
import {Injectable} from '@angular/core';
import {Observable} from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class AiService {

  constructor(private http: HttpClient) { }

  sendMessage(apiUrl: string, token: string, model: string, messages: any[]): Observable<any> {
    const url = `${apiUrl}/chat/completions`;
    const headers = {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    };
    const body = {
      model: model,
      messages: messages
    };
    return this.http.post(url, body, { headers });
  }
}
