import { bootstrapApplication } from '@angular/platform-browser';
import { AppComponent } from './app/app.component';
import { appConfig } from './app/app.config';

export class Compatibility {

  static settings = '1.0.0';
  static cloud = '1.0.0';
  static secrets = '1.0.0';
  static profiles = '1.0.0';
}

bootstrapApplication(AppComponent, appConfig)
  .catch((err) => console.error(err));
