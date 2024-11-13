import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import {MatSidenav, MatSidenavContainer, MatSidenavContent} from '@angular/material/sidenav';
import {MatTab, MatTabGroup} from '@angular/material/tabs';
import {TerminalComponent} from './terminal/terminal.component';
import {Profile} from './domain/Profile';
import {Terminal} from './domain/Terminal';
import {CommonModule, NgForOf} from '@angular/common';
import {AppModule} from './app.module';
import {MatIcon} from '@angular/material/icon';
import {MatNavList} from '@angular/material/list';
import {MatFabButton, MatMiniFabButton} from '@angular/material/button';
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
  ],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})
export class AppComponent {
  title = 'myTermX';
  terminals: Terminal[] = [];
  settings: any;
  profiles: Profile[] = [];

  addTerminal() {
    this.terminals.push(new Terminal(this.terminals.length)); // Adds a new terminal identifier
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
