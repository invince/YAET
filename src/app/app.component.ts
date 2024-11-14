import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import {MatSidenav, MatSidenavContainer, MatSidenavContent} from '@angular/material/sidenav';
import {MatTab, MatTabGroup, MatTabLabel} from '@angular/material/tabs';
import {TerminalComponent} from './terminal/terminal.component';
import {Profile} from './domain/Profile';
import {TabInstance} from './domain/TabInstance';
import {CommonModule, NgForOf} from '@angular/common';
import {AppModule} from './app.module';
import {MatIcon} from '@angular/material/icon';
import {MatNavList} from '@angular/material/list';
import {MatFabButton, MatIconButton, MatMiniFabButton} from '@angular/material/button';
import {MatMenuItem} from '@angular/material/menu';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    RouterOutlet,
    MatSidenavContent,
    MatSidenav,
    MatSidenavContainer,
    MatTabGroup,
    MatTab,
    CommonModule,

    AppModule,
    TerminalComponent,
    MatIcon,
    MatMiniFabButton,
    MatTabLabel,
    MatIconButton,
  ],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})
export class AppComponent {
  title = 'myTermX';
  tabs: TabInstance[] = [];
  settings: any;
  profiles: Profile[] = [];

  addTerminal() {
    this.tabs.push(new TabInstance(this.tabs.length, 'terminal')); // Adds a new terminal identifier
  }

  removeTab(index: number) {
    this.tabs.splice(index, 1);
  }

  saveMenu() {

  }

  favoriteMenu() {

  }

  syncMenu() {

  }

  settingMenu() {

  }


}
