import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import {MatSidenav, MatSidenavContainer, MatSidenavContent} from '@angular/material/sidenav';
import {MatTab, MatTabGroup} from '@angular/material/tabs';
import {TerminalComponent} from './terminal-component/terminal-component.component';
import {Profile} from './domain/Profile';
import {Terminal} from './domain/Terminal';
import {CommonModule, NgForOf} from '@angular/common';

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

    TerminalComponent,
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
}
