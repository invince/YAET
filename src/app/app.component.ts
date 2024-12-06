import {Component, OnDestroy, OnInit} from '@angular/core';
import {RouterOutlet} from '@angular/router';
import {MatSidenavModule} from '@angular/material/sidenav';
import {MatTabsModule} from '@angular/material/tabs';
import {TerminalComponent} from './components/terminal/terminal.component';
import { ProfileCategory, ProfileType} from './domain/Profile';
import {TabInstance} from './domain/TabInstance';
import {CommonModule} from '@angular/common';
import {MatIcon} from '@angular/material/icon';
import {MatButtonModule} from '@angular/material/button';
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
import {Subscription} from 'rxjs';
import {ModalControllerService} from './services/modal-controller.service';
import {CloudComponent} from './components/menu/cloud/cloud.component';
import {CloudService} from './services/cloud.service';
import {NgxSpinnerModule} from 'ngx-spinner';

@Component({
  selector: 'app-root',
  standalone: true,
    imports: [
      RouterOutlet,
      TerminalComponent,
      MenuComponent,

      MatSidenavModule,
      MatTabsModule,
      MatButtonModule,
      NgxSpinnerModule,

      MatIcon,

      CommonModule,

      ProfileFormComponent,
      SettingMenuComponent,
      RemoteDesktopComponent,
      FileExplorerComponent,
      SecuresMenuComponent,
      ProfilesMenuComponent,
      QuickconnectMenuComponent,
      CloudComponent,
    ],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css',
  animations: [
    menuAnimation,
  ],
})
export class AppComponent implements OnInit, OnDestroy{


  title = 'yetAnotherElectronTerm';
  tabs: TabInstance[] = [];



  currentTabIndex = 0;

  subscriptions: Subscription[] = []

  constructor(
    private settingService: SettingService,
    private profileService: ProfileService,
    private secretService: SecretService,
    private masterKeyService: MasterKeyService,
    private cloudService: CloudService,

    public modalControl: ModalControllerService,

    private _snackBar: MatSnackBar,
    public dialog: MatDialog,
  ) {}

  ngOnInit() {
    this.subscriptions.push(
      this.profileService.connectionEvent$.subscribe(
        connection => {
          if (!connection) {
            this._snackBar.open('Empty Connection found', 'OK', {
              duration: 3000
            });
            return;
          }
          this.modalControl.closeModal(['favorite', 'add']);
          this.tabs.push(new TabInstance(uuidv4(), connection.category, connection.profileType, connection)); // Adds a new terminal identifier
          this.currentTabIndex = this.tabs.length - 1;
        }
      )
    )
  }

  ngOnDestroy() {
    this.subscriptions.forEach(one => one.unsubscribe());
  }

  initialized() {
    return this.settingService.isLoaded
            && this.profileService.isLoaded
            && this.secretService.isLoaded
            && this.masterKeyService.isMasterKeyLoaded
            && this.cloudService.isLoaded
      ;
  }

  removeTab(index: number) {
    this.tabs.splice(index, 1);
  }


  toggleMenu(menu: string) {
    this.modalControl.toggleMenu(menu);
  }

  addLocalTerminal() {
    this.modalControl.closeModal();
    this.tabs.push(new TabInstance(uuidv4(), ProfileCategory.TERMINAL, ProfileType.LOCAL_TERMINAL, this.settingService.createLocalTerminalProfile())); // Adds a new terminal identifier
    this.currentTabIndex = this.tabs.length - 1;
  }

  addMenu() {
    this.toggleMenu('add');
  }


  secureMenu() {
    this.requireMasterKey(() => this.toggleMenu('secure'));
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
    this.requireMasterKey(() => this.toggleMenu('favorite'));
  }

  cloudMenu() {
    this.requireMasterKey(() => this.toggleMenu('cloud'));
  }


  settingMenu() {
    this.toggleMenu('setting');
  }


}
