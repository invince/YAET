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
import {ProfileFormComponent} from './components/menu/profile-form/profile-form.component';
import {SettingMenuComponent} from './components/menu/setting-menu/setting-menu.component';
import {SettingService} from './services/setting.service';
import {ProfileService} from './services/profile.service';
import {RemoteDesktopComponent} from './components/remote-desktop/remote-desktop.component';
import {FileExplorerComponent} from './components/file-explorer/file-explorer.component';
import {v4 as uuidv4} from 'uuid';
import {SecuresMenuComponent} from './components/menu/secures-menu/secures-menu.component';
import {SecretService} from './services/secret.service';
import {MatSnackBar} from '@angular/material/snack-bar';
import {ProfilesMenuComponent} from './components/menu/profiles-menu/profiles-menu.component';
import {QuickconnectMenuComponent} from "./components/menu/quickconnect-menu/quickconnect-menu.component";
import {MasterKeyComponent} from './components/menu/master-key/master-key.component';
import {MatDialog} from '@angular/material/dialog';
import {MasterKeyService} from './services/master-key.service';

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

        ProfileFormComponent,
        SettingMenuComponent,
        RemoteDesktopComponent,
        FileExplorerComponent,
        SecuresMenuComponent,
        ProfilesMenuComponent,
        QuickconnectMenuComponent,
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
    private secretService: SecretService,
    private masterKeyService: MasterKeyService,

    private _snackBar: MatSnackBar,
    public dialog: MatDialog,
  ) {
  }

  initialized() {
    return this.settingService.isLoaded
            && this.profileService.isLoaded
            && this.secretService.isLoaded
            && this.masterKeyService.isMasterKeyLoaded
      ;
  }

  removeTab(index: number) {
    this.tabs.splice(index, 1);
  }

  addLocalTerminal() {
    this.isMenuModalOpen = false;
    this.tabs.push(new TabInstance(uuidv4(), ProfileCategory.TERMINAL, ProfileType.LOCAL_TERMINAL, this.settingService.createLocalTerminalProfile())); // Adds a new terminal identifier
    this.currentTabIndex = this.tabs.length - 1;
  }

  toggleMenu(menu: string) {
    if (this.currentOpenedMenu == menu) {
      this.isMenuModalOpen = !this.isMenuModalOpen;
    } else {
      this.currentOpenedMenu = menu;
      this.isMenuModalOpen = true;
    }

  }


  addMenu() {
    this.toggleMenu('add');
  }


  secureMenu() {
    this.requireMasterKey(() => this.toggleMenu('secure'))
  }

  requireMasterKey(callback: ()=>void) {
    if (this.masterKeyService.hasMasterKey) {
      callback();
    } else {
      const snackBarRef = this._snackBar.open('Please define Master key in Settings first', 'Set it', {
        duration: 3000
      });

      snackBarRef.onAction().subscribe(() => {
        this.openMasterKeyModal();
      });
    }
  }

  openMasterKeyModal() {
    const dialogRef = this.dialog.open(MasterKeyComponent, {
      width: '260px',
      data: {}
    });

    dialogRef.afterClosed().subscribe(result => {
      console.log('The dialog was closed');
    });
  }

  favoriteMenu() {
    this.requireMasterKey(() => this.toggleMenu('favorite'))
  }

  syncMenu() {
    this.toggleMenu('cloud');
  }


  settingMenu() {
    this.toggleMenu('setting');
  }

  closeModal() {
    this.isMenuModalOpen = false;
    this.currentOpenedMenu = '';
  }

  onProfileConnect($event: Profile) {
    if ($event) {
      this.isMenuModalOpen = false;
      this.tabs.push(new TabInstance(uuidv4(), $event.category, $event.profileType, $event)); // Adds a new terminal identifier
      this.currentTabIndex = this.tabs.length - 1;
    }
  }
}
