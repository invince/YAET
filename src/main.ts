import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { AppComponent } from './app/app.component';

import { registerLicense } from '@syncfusion/ej2-base';

export class Compatibility {

  static settings = '1.0.0';
  static cloud = '1.0.0';
  static secrets = '1.0.0';
  static profiles = '1.0.0';
}

// Registering Syncfusion license key
registerLicense('xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx');

bootstrapApplication(AppComponent, appConfig)
  .catch((err) => console.error(err));
