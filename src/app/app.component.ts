import {Component, OnDestroy, OnInit} from '@angular/core';
import {RouterOutlet} from '@angular/router';
import {MatSidenavModule} from '@angular/material/sidenav';
import {MatTabsModule} from '@angular/material/tabs';
import {TerminalComponent} from './components/terminal/terminal.component';
import {Profile, ProfileCategory, ProfileType} from './domain/profile/Profile';
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
import {SecretsMenuComponent} from './components/menu/secrets-menu/secrets-menu.component';
import {SecretService} from './services/secret.service';
import {ProfilesMenuComponent} from './components/menu/profiles-menu/profiles-menu.component';
import {QuickconnectMenuComponent} from "./components/menu/quickconnect-menu/quickconnect-menu.component";
import {MasterKeyComponent} from './components/dialog/master-key/master-key.component';
import {MatDialog} from '@angular/material/dialog';
import {MasterKeyService} from './services/master-key.service';
import {Subscription} from 'rxjs';
import {ModalControllerService} from './services/modal-controller.service';
import {CloudComponent} from './components/menu/cloud/cloud.component';
import {CloudService} from './services/cloud.service';
import {NgxSpinnerModule} from 'ngx-spinner';
import {TabService} from './services/tab.service';
import {MenuConsts} from './domain/MenuConsts';
import {SessionService} from './services/session.service';
import {SettingStorageService} from './services/setting-storage.service';
import {LogService} from './services/log.service';
import {NotificationService} from './services/notification.service';

@Component({
  selector: 'app-root',
  standalone: true,
    imports: [
      TerminalComponent,
      MatSidenavModule,
      MatTabsModule,
      MatButtonModule,
      NgxSpinnerModule,

      MatIcon,

      CommonModule,

      SettingMenuComponent,
      RemoteDesktopComponent,
      FileExplorerComponent,
      SecretsMenuComponent,
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

  MENU_ADD: string = MenuConsts.MENU_ADD;
  MENU_PROFILE: string = MenuConsts.MENU_PROFILE;
  MENU_SECURE: string = MenuConsts.MENU_SECURE;
  MENU_CLOUD: string = MenuConsts.MENU_CLOUD;
  MENU_SETTING: string = MenuConsts.MENU_SETTING;

  title = 'yetAnotherElectronTerm';

  subscriptions: Subscription[] = [];

  settingInitialized = false;



  constructor(
    private log: LogService,

    private settingService: SettingService,
    private settingStorage: SettingStorageService,
    private profileService: ProfileService,
    private secretService: SecretService,
    private sessionService: SessionService,
    private masterKeyService: MasterKeyService,
    private cloudService: CloudService,
    public tabService: TabService,

    public modalControl: ModalControllerService,

    private notification: NotificationService,
    public dialog: MatDialog,
  ) {}

  ngOnInit() {
    this.subscriptions.push(
      this.profileService.connectionEvent$.subscribe(
        profile => {
          if (!profile) {
            this.notification.error('Empty Connection found');
            return;
          }
          this.modalControl.closeModal([this.MENU_PROFILE, this.MENU_ADD ]);
          if (Profile.requireOpenNewTab(profile)) {
            const tab = new TabInstance(profile.category, this.sessionService.create(profile, profile.profileType));
            this.tabService.addTab(tab); // Adds a new terminal identifier
            this.tabService.currentTabIndex = this.tabService.tabs.findIndex(one => one.id === tab.id);
          } else {
            this.sessionService.openSessionWithoutTab(profile);
          }
        }
      )
    );

    this.subscriptions.push(
      this.settingService.settingLoadedEvent.subscribe(
        evt => {
          if (!this.settingInitialized &&
            this.settingStorage.settings.terminal?.localTerminal?.defaultOpen ) {
            this.addLocalTerminal();
          }

          this.settingInitialized = true;
        }
      )
    );

  }

  ngOnDestroy() {
    this.subscriptions.forEach(one => one.unsubscribe());
  }

  allSettingLoaded() {
    return this.settingService.isLoaded
            && this.profileService.isLoaded
            && this.secretService.isLoaded
            && this.masterKeyService.isMasterKeyLoaded
            && this.cloudService.isLoaded
      ;
  }

  removeTab(index: number) {
    this.tabService.tabs.splice(index, 1);
  }


  toggleMenu(menu: string) {
    this.modalControl.toggleMenu(menu);
  }

  reconnect(i: number) {
    this.tabService.reconnect(i);
  }

  addLocalTerminal() {
    this.modalControl.closeModal();
    const tab = new TabInstance( ProfileCategory.TERMINAL,
      this.sessionService.create(this.settingService.createLocalTerminalProfile(),ProfileType.LOCAL_TERMINAL));
    this.tabService.addTab(tab); // Adds a new terminal identifier
    this.tabService.currentTabIndex = this.tabService.tabs.findIndex(one => one.id === tab.id);
  }



  addMenu() {
    this.requireMasterKey(() => this.toggleMenu( this.MENU_ADD));
  }


  secureMenu() {
    this.requireMasterKey(() => this.toggleMenu( this.MENU_SECURE));
  }

  requireMasterKey(callback: ()=>void) {
    if (this.masterKeyService.hasMasterKey) {
      callback();
    } else {
      this.notification.info('Please define Master key in Settings first', 'Set it', () => {
        this.openMasterKeyModal();
      });
    }
  }

  openMasterKeyModal() {
    const dialogRef = this.dialog.open(MasterKeyComponent, {
      width: '260px',
      data: {}
    });

    this.subscriptions.push(dialogRef.afterClosed().subscribe(result => {
      this.log.debug('Master key modal closed');
    }));
  }

  profileMenu() {
    this.requireMasterKey(() => this.toggleMenu(this.MENU_PROFILE));
  }

  cloudMenu() {
    this.requireMasterKey(() => this.toggleMenu(this.MENU_CLOUD));
  }


  settingMenu() {
    this.toggleMenu(this.MENU_SETTING);
  }


}
