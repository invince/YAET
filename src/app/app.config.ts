import {HttpClient, provideHttpClient, withInterceptorsFromDi} from '@angular/common/http';
import {ApplicationConfig, provideZoneChangeDetection} from '@angular/core';
import {provideAnimationsAsync} from '@angular/platform-browser/animations/async';
import {provideRouter} from '@angular/router';
import {provideTranslateService, TranslateLoader} from '@ngx-translate/core';
import {MessageService} from 'primeng/api';
import {providePrimeNG} from 'primeng/config';
import Aura from '@primeng/themes/aura';
import {DialogService} from 'primeng/dynamicdialog';
import {Observable} from 'rxjs';
import {routes} from './app.routes';

export class CustomTranslateLoader implements TranslateLoader {
  constructor(private http: HttpClient) { }
  getTranslation(lang: string): Observable<any> {
    return this.http.get(`./assets/i18n/${lang}.json`);
  }
}

export function HttpLoaderFactory(http: HttpClient) {
  return new CustomTranslateLoader(http);
}

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes),
    provideAnimationsAsync(),
    provideHttpClient(withInterceptorsFromDi()),
    MessageService,
    DialogService,
    providePrimeNG({
        theme: {
            preset: Aura,
            options: {
                darkModeSelector: '.p-dark'
            }
        }
    }),
    provideTranslateService({
      defaultLanguage: 'en',
      loader: {
        provide: TranslateLoader,
        useFactory: HttpLoaderFactory,
        deps: [HttpClient]
      }
    })
  ]
};
