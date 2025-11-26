import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatIcon } from '@angular/material/icon';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatTabsModule } from '@angular/material/tabs';
import { NgxSpinnerModule } from 'ngx-spinner';
import { Subscription } from 'rxjs';
import { menuAnimation } from './animations/menuAnimation';
import { FileExplorerComponent } from './components/file-explorer/file-explorer.component';
import { CloudComponent } from './components/menu/cloud/cloud.component';
import { ProfilesMenuComponent } from './components/menu/profiles-menu/profiles-menu.component';
import { QuickconnectMenuComponent } from "./components/menu/quickconnect-menu/quickconnect-menu.component";
import { SecretsMenuComponent } from './components/menu/secrets-menu/secrets-menu.component';
import { SettingMenuComponent } from './components/menu/setting-menu/setting-menu.component';
import { RemoteDesktopComponent } from './components/remote-desktop/remote-desktop.component';
import { SidebarComponent } from './components/sidebar/sidebar.component';
import { TerminalComponent } from './components/terminal/terminal.component';
import { MenuConsts } from './domain/MenuConsts';
import { Profile, ProfileCategory, ProfileType } from './domain/profile/Profile';
import { TabInstance } from './domain/TabInstance';
import { CloudService } from './services/cloud.service';
import { LogService } from './services/log.service';
import { MasterKeyService } from './services/master-key.service';
import { ModalControllerService } from './services/modal-controller.service';
import { NotificationService } from './services/notification.service';
import { ProfileService } from './services/profile.service';
import { SecretService } from './services/secret.service';
import { SessionService } from './services/session.service';
import { SettingStorageService } from './services/setting-storage.service';
import { SettingService } from './services/setting.service';
import { TabService } from './services/tab.service';

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
    SidebarComponent,
  ],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css',
  animations: [
    menuAnimation,
  ],
})
export class AppComponent implements OnInit, OnDestroy {

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
  ) { }

  ngOnInit() {
    this.subscriptions.push(
      this.profileService.connectionEvent$.subscribe(
        profile => {
          if (!profile) {
            this.notification.error('Empty Connection found');
            return;
          }
          this.modalControl.closeModal([this.MENU_PROFILE, this.MENU_ADD]);
          if (Profile.requireOpenNewTab(profile)) {
            const tab = new TabInstance(profile.category, this.sessionService.create(profile, profile.profileType));
            this.tabService.addTab(tab); // Adds a new terminal identifier
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
            this.settingStorage.settings.terminal?.localTerminal?.defaultOpen) {
            this.modalControl.closeModal();
            const tab = new TabInstance(ProfileCategory.TERMINAL,
              this.sessionService.create(this.settingService.createLocalTerminalProfile(), ProfileType.LOCAL_TERMINAL));
            this.tabService.addTab(tab);
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

  reconnect(i: number) {
    this.sessionService.reconnect(i);
  }

  removeTab(index: number, paneId: number = 0) {
    this.tabService.removeTab(index, paneId);
  }





  onTabLabelMouseDown($event: MouseEvent, index: number, paneId: number = 0) {
    if ($event.button === 1) { // middle button
      $event.preventDefault();
      this.removeTab(index, paneId);
    }
  }



  setActivePane(paneId: number) {
    this.tabService.setActivePane(paneId);
  }
}
