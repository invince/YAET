import { NgModule } from '@angular/core';
import { AppComponent } from './app.component';
import { MatIconModule } from '@angular/material/icon';
import { MatTabsModule } from '@angular/material/tabs';
import { MatButtonModule } from '@angular/material/button';
import {CommonModule} from '@angular/common';

@NgModule({
  declarations: [
  ],
  imports: [
    MatIconModule,
    MatTabsModule,
    MatButtonModule,
    CommonModule,
  ],
  providers: [],
  exports: [

  ],
  bootstrap: [AppComponent]
})
export class AppModule { }
