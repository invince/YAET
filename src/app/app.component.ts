import { CommonModule, DOCUMENT } from '@angular/common';
import {
  Component,
  Inject,
  OnDestroy,
  OnInit,
  Renderer2
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatIcon } from '@angular/material/icon';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatTabsModule } from '@angular/material/tabs';
import { TranslateService } from '@ngx-translate/core';
import { NgxSpinnerModule } from 'ngx-spinner';
import { Subscription } from 'rxjs';
import { menuAnimation } from './animations/menuAnimation';
import { BottomToolbarComponent } from './components/bottom-toolbar/bottom-toolbar.component';
import { FileExplorerComponent } from './components/file-explorer/file-explorer.component';
import { CloudComponent } from './components/menu/cloud/cloud.component';
import { ProfilesMenuComponent } from './components/menu/profiles-menu/profiles-menu.component';
import { ProxyMenuComponent } from './components/menu/proxy-menu/proxy-menu.component';
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
    ProxyMenuComponent,
    ProfilesMenuComponent,
    QuickconnectMenuComponent,
    CloudComponent,
    SidebarComponent,
    BottomToolbarComponent,
  ],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css',
  animations: [
    menuAnimation,
  ]
})
export class AppComponent implements OnInit, OnDestroy {

  MENU_ADD: string = MenuConsts.MENU_ADD;
  MENU_PROFILE: string = MenuConsts.MENU_PROFILE;
  MENU_SECURE: string = MenuConsts.MENU_SECURE;
  MENU_PROXY: string = MenuConsts.MENU_PROXY;
  MENU_CLOUD: string = MenuConsts.MENU_CLOUD;
  MENU_SETTING: string = MenuConsts.MENU_SETTING;

  title = 'yetAnotherElectronTerm';

  subscriptions: Subscription[] = [];

  settingInitialized = false;

  // Drag and drop state
  draggedTab: { tab: TabInstance, index: number, paneId: number } | null = null;
  dragOverPane: number | null = null;


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
    @Inject(TranslateService) private translate: TranslateService,
    @Inject(DOCUMENT) private document: Document,
    private renderer: Renderer2
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

          // Initialize language
          this.translate.setDefaultLang('en');
          const savedLang = this.settingStorage.settings.general?.language || 'en';
          this.translate.use(savedLang);

          // Apply theme
          this.applyTheme(this.settingStorage.settings.ui?.theme);
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

  reconnect(tab: TabInstance) {
    // Find the global index of this tab
    const globalIndex = this.tabService.tabs.indexOf(tab);
    if (globalIndex !== -1) {
      this.sessionService.reconnect(globalIndex);
    }
  }

  removeTab(index: number, paneId: number = 0) {
    this.tabService.removeTab(index, paneId);
  }

  onTabLabelMouseDown($event: MouseEvent, index: number, paneId: number = 0) {
    // Only handle middle button (close tab) - don't interfere with left button drag
    if ($event.button === 1) { // middle button
      $event.preventDefault();
      this.removeTab(index, paneId);
    }
  }

  setActivePane(paneId: number) {
    this.tabService.setActivePane(paneId);
  }

  // Drag and drop handlers
  onTabDragStart(event: DragEvent, tab: TabInstance, index: number, paneId: number) {
    this.draggedTab = { tab, index, paneId };
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/plain', tab.id);
    }
  }

  onTabDragEnd() {
    this.draggedTab = null;
    this.dragOverPane = null;
  }

  onPaneDragOver(event: DragEvent, paneId: number) {
    if (!this.draggedTab || !this.tabService.splitMode) {
      return;
    }

    // Only allow drop if dragging to different pane
    if (this.draggedTab.paneId !== paneId) {
      event.preventDefault();
      if (event.dataTransfer) {
        event.dataTransfer.dropEffect = 'move';
      }
      this.dragOverPane = paneId;
    }
  }

  onPaneDragLeave(paneId: number) {
    if (this.dragOverPane === paneId) {
      this.dragOverPane = null;
    }
  }

  onPaneDrop(event: DragEvent, targetPaneId: number) {
    event.preventDefault();

    if (!this.draggedTab || !this.tabService.splitMode) {
      return;
    }

    // Move tab to target pane
    if (this.draggedTab.paneId !== targetPaneId) {
      this.tabService.moveTabToPane(this.draggedTab.tab, targetPaneId);
    }

    this.draggedTab = null;
    this.dragOverPane = null;
    this.draggedTab = null;
    this.dragOverPane = null;
  }

  applyTheme(theme: string | undefined) {
    if (!theme) {
      theme = 'pink-bluegrey';
    }
    // remove old theme classes
    const classes = this.document.body.classList;
    const toRemove: string[] = [];
    for (let i = 0; i < classes.length; i++) {
      const cls = classes.item(i);
      if (cls && cls.startsWith('theme-')) {
        toRemove.push(cls);
      }
    }
    toRemove.forEach(c => this.renderer.removeClass(this.document.body, c));

    // add new theme class
    this.renderer.addClass(this.document.body, 'theme-' + theme);
  }
}
