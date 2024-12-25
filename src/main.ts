import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { AppComponent } from './app/app.component';

import { registerLicense } from '@syncfusion/ej2-base';

// Registering Syncfusion license key
registerLicense('Ngo9BigBOggjHTQxAR8/V1NMaF5cXmBCf1FpRmJGfV5ycEVFallWTnJYUj0eQnxTdEFiW31acXFQQWRbUEJ1Xg==');

bootstrapApplication(AppComponent, appConfig)
  .catch((err) => console.error(err));
