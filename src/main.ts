import { bootstrapApplication } from '@angular/platform-browser';
import { AppComponent } from './app/app.component';
import { appConfig } from './app/app.config';

/** Compatibility versions moved to app/compatibility.ts (import from there). */
export { Compatibility } from './app/compatibility';

bootstrapApplication(AppComponent, appConfig)
  .catch((err) => console.error(err));
