import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { AppComponent } from './app/app.component';

import { registerLicense } from '@syncfusion/ej2-base';

import config from '../config/config.json';

export class Compatibility {

  static settings = '0.9.0';
  static cloud = '0.9.0';
  static secrets = '0.9.0';
  static profiles = '0.9.0';
}

// Registering Syncfusion license key
registerLicense(config.scfLK);

bootstrapApplication(AppComponent, appConfig)
  .catch((err) => console.error(err));
