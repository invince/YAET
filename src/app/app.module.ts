import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { AppComponent } from './app.component';
import { TabContainerComponent } from './tab-container/tab-container.component';
import { TerminalTabComponent } from './terminal-tab/terminal-tab.component';
import { MatIconModule } from '@angular/material/icon';
import { MatTabsModule } from '@angular/material/tabs';
import { MatButtonModule } from '@angular/material/button';
import {CommonModule} from '@angular/common';

@NgModule({
  declarations: [
    TabContainerComponent,
    TerminalTabComponent
  ],
  imports: [
    MatIconModule,
    MatTabsModule,
    MatButtonModule,
    CommonModule,
  ],
  providers: [],
  exports: [
    TabContainerComponent
  ],
  bootstrap: [AppComponent]
})
export class AppModule { }
