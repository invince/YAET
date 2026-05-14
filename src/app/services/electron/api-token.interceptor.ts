import {HttpEvent, HttpHandlerFn, HttpRequest} from '@angular/common/http';
import {Observable} from 'rxjs';
import {GET_API_TOKEN} from './ElectronConstant';

let cachedToken: string | null = null;

async function getToken(): Promise<string | null> {
  if (cachedToken) return cachedToken;
  try {
    const api = (window as any).electronAPI;
    if (api?.invoke) {
      cachedToken = await api.invoke(GET_API_TOKEN) as string;
      return cachedToken;
    }
  } catch { /* IPC not available */ }
  return null;
}

export function apiTokenInterceptor(req: HttpRequest<unknown>, next: HttpHandlerFn): Observable<HttpEvent<unknown>> {
  if (!req.url.startsWith('http://localhost:13012/api')) {
    return next(req);
  }

  return new Observable(observer => {
    getToken().then(token => {
      if (token) {
        req = req.clone({
          setHeaders: { 'x-api-token': token }
        });
      }
      next(req).subscribe({
        next: e => observer.next(e),
        error: e => observer.error(e),
        complete: () => observer.complete(),
      });
    });
  });
}
