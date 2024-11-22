import {Component} from '@angular/core';
import {RouterOutlet} from '@angular/router';
import {MatSidenav, MatSidenavContainer, MatSidenavContent} from '@angular/material/sidenav';
import {MatTab, MatTabGroup, MatTabLabel} from '@angular/material/tabs';
import {TerminalComponent} from './components/terminal/terminal.component';
import {Profile, ProfileCategory, ProfileType} from './domain/Profile';
import {TabInstance} from './domain/TabInstance';
import {CommonModule} from '@angular/common';
import {MatIcon} from '@angular/material/icon';
import {MatIconButton, MatMiniFabButton} from '@angular/material/button';
import {menuAnimation} from './animations/menuAnimation';
import {MenuComponent} from './components/menu/menu.component';
import {ProfileMenuComponent} from './components/menu/profile-menu/profile-menu.component';
import {SettingMenuComponent} from './components/menu/setting-menu/setting-menu.component';
import {SettingService} from './services/setting.service';
import {ProfileService} from './services/profile.service';
import {RemoteDesktopComponent} from './components/remote-desktop/remote-desktop.component';
import {FileExplorerComponent} from './components/file-explorer/file-explorer.component';
import {v4 as uuidv4} from 'uuid';
import {SecureMenuComponent} from './components/menu/secure-menu/secure-menu.component';

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
    SettingMenuComponent,
    RemoteDesktopComponent,
    FileExplorerComponent,
    SecureMenuComponent,


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
  profiles: Profile[] = [];

  isMenuModalOpen = false; // if menu modal open
  currentOpenedMenu = '';

  currentTabIndex = 0;

  constructor(
    private settingService: SettingService,
    private profileService: ProfileService,
  ) {
  }

  initialized() {
    return this.settingService.isLoaded
            && this.profileService.isLoaded;
  }

  removeTab(index: number) {
    this.tabs.splice(index, 1);
  }

  addLocalTerminal() {
    this.isMenuModalOpen = false;
    this.tabs.push(new TabInstance(uuidv4(), ProfileCategory.TERMINAL, ProfileType.LOCAL_TERMINAL, this.settingService.createLocalTerminalProfile())); // Adds a new terminal identifier
    this.currentTabIndex = this.tabs.length - 1;
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


  secureMenu() {
    this.openMenu('secure');
  }

  favoriteMenu() {
    this.openMenu('favorite');
  }

  syncMenu() {
    this.openMenu('cloud');
  }


  settingMenu() {
    this.openMenu('setting');
  }

  closeModal() {
    this.isMenuModalOpen = false;
    this.currentOpenedMenu = '';
  }

  createNewProfile(): Profile {
    return new Profile();
  }

  onProfileConnect($event: Profile) {
    if ($event) {
      this.isMenuModalOpen = false;
      this.tabs.push(new TabInstance(uuidv4(), $event.category, $event.profileType, $event)); // Adds a new terminal identifier
      this.currentTabIndex = this.tabs.length - 1;
    }
  }
}
