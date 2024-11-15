import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import {MatSidenav, MatSidenavContainer, MatSidenavContent} from '@angular/material/sidenav';
import {MatTab, MatTabGroup, MatTabLabel} from '@angular/material/tabs';
import {TerminalComponent} from './components/terminal/terminal.component';
import {Profile} from './domain/Profile';
import {TabInstance} from './domain/TabInstance';
import {CommonModule, NgForOf} from '@angular/common';
import {MatIcon} from '@angular/material/icon';
import {MatIconButton, MatMiniFabButton} from '@angular/material/button';
import {menuAnimation} from './menuAnimation';
import {MenuComponent} from './components/menu/menu.component';
import {ProfileMenuComponent} from './components/profile-menu/profile-menu.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    RouterOutlet,
    TerminalComponent,
    MenuComponent,

    MatSidenavContent,
    MatSidenav,
    MatSidenavContainer,
    MatTabGroup,
    MatTab,
    MatIcon,
    MatMiniFabButton,
    MatTabLabel,
    MatIconButton,
    CommonModule,
    ProfileMenuComponent,


  ],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css',
  animations: [
    menuAnimation,
  ],
})
export class AppComponent {
  title = 'yetAnotherElectronTerm';
  tabs: TabInstance[] = [];
  settings: any;
  profiles: Profile[] = [];

  isMenuModalOpen = false; // if menu modal open
  currentOpenedMenu = '';

  removeTab(index: number) {
    this.tabs.splice(index, 1);
  }

  addLocalTerminal() {
    this.isMenuModalOpen = false;
    this.tabs.push(new TabInstance(this.tabs.length, 'terminal')); // Adds a new terminal identifier
  }

  openMenu(menu: string) {
    if (this.currentOpenedMenu == menu) {
      this.isMenuModalOpen = !this.isMenuModalOpen;
    } else {
      this.currentOpenedMenu = menu;
      this.isMenuModalOpen = true;
    }

  }


  addMenu() {
    this.openMenu('add');
  }


  saveMenu() {
    this.openMenu('save');
  }

  favoriteMenu() {
    this.openMenu('favorite');
  }

  syncMenu() {
    this.openMenu('cloud');
  }


  // 打开设置窗口
  settingMenu() {
    this.openMenu('setting');
  }

  closeModal() {
    this.isMenuModalOpen = false;
    this.currentOpenedMenu = '';
  }
}
