import {Injectable, NgZone} from '@angular/core';
import {MatDialog, MatDialogRef} from '@angular/material/dialog';
import {AiChatService} from './ai-chat.service';
import {MasterKeyService} from './master-key.service';
import {ModalControllerService} from './modal-controller.service';
import {NotificationService} from './notification.service';
import {SessionService} from './session.service';
import {SettingService} from './setting.service';
import {TabService} from './tab.service';
import {ShortcutHelpComponent} from '../components/dialog/shortcut-help/shortcut-help.component';
import {MenuConsts} from '../domain/MenuConsts';
import {TabInstance} from '../domain/TabInstance';
import {LOCAL_TERMINAL, ProfileCategory} from '../domain/profile/Profile';

@Injectable({
  providedIn: 'root'
})
export class ShortcutService {

  private initialized = false;
  private shortcutHelpRef: MatDialogRef<ShortcutHelpComponent> | null = null;
  private openStack: ('menu' | 'help')[] = [];

  constructor(
    private tabService: TabService,
    private sessionService: SessionService,
    private settingService: SettingService,
    private modalControl: ModalControllerService,
    private masterKeyService: MasterKeyService,
    private notification: NotificationService,
    private aiChatService: AiChatService,
    private ngZone: NgZone,
    private dialog: MatDialog,
  ) {}

  init() {
    if (this.initialized) return;
    this.initialized = true;

    this.ngZone.runOutsideAngular(() => {
      document.addEventListener('keydown', (event: KeyboardEvent) => this.onKeydown(event));
    });
  }

  destroy() {
    if (!this.initialized) return;
    this.initialized = false;
    document.removeEventListener('keydown', (event: KeyboardEvent) => this.onKeydown(event));
  }

  private onKeydown(event: KeyboardEvent) {
    const ctrl = event.ctrlKey || event.metaKey;
    const shift = event.shiftKey;
    const key = event.key.toLowerCase();

    if (key === 'escape') {
      const top = this.openStack[this.openStack.length - 1];
      if (top === 'help' && this.shortcutHelpRef) {
        event.preventDefault();
        this.openStack.pop();
        this.shortcutHelpRef.close();
        return;
      }
      if (top === 'menu') {
        event.preventDefault();
        this.ngZone.run(() => this.closeMenu());
      }
      return;
    }

    if (ctrl && shift && key === 'n') {
      event.preventDefault();
      this.ngZone.run(() => this.addLocalTerminal());
      return;
    }

    if (ctrl && shift && key === 'w') {
      event.preventDefault();
      this.ngZone.run(() => this.closeCurrentTab());
      return;
    }

    if (ctrl && key === 'tab' && !shift) {
      event.preventDefault();
      this.ngZone.run(() => this.nextTab());
      return;
    }

    if (ctrl && key === 'tab' && shift) {
      event.preventDefault();
      this.ngZone.run(() => this.prevTab());
      return;
    }

    if (ctrl && shift && key === 'p') {
      event.preventDefault();
      this.ngZone.run(() => this.toggleMenu(MenuConsts.MENU_PROFILE));
      return;
    }

    if (ctrl && shift && key === 's') {
      event.preventDefault();
      this.ngZone.run(() => this.toggleMenu(MenuConsts.MENU_SECURE));
      return;
    }

    if (ctrl && shift && event.code === 'Comma') {
      event.preventDefault();
      this.ngZone.run(() => this.toggleMenu(MenuConsts.MENU_SETTING));
      return;
    }

    if (ctrl && shift && key === 'q') {
      event.preventDefault();
      this.ngZone.run(() => this.toggleMenu(MenuConsts.MENU_ADD));
      return;
    }

    if (ctrl && shift && key === 'i') {
      event.preventDefault();
      this.ngZone.run(() => this.aiChatService.toggle());
      return;
    }

    if (ctrl && shift && key === 'h') {
      event.preventDefault();
      this.ngZone.run(() => this.showShortcutHelp());
      return;
    }
  }

  private addLocalTerminal() {
    if (!this.masterKeyService.hasMasterKey) {
      this.notification.info('Please define Master key in Settings first');
      return;
    }
    this.modalControl.closeModal();
    const tab = new TabInstance(ProfileCategory.TERMINAL,
      this.sessionService.create(this.settingService.createLocalTerminalProfile(), LOCAL_TERMINAL));
    this.tabService.addTab(tab);
  }

  private closeCurrentTab() {
    const paneTabs = this.tabService.getTabsForPane(this.tabService.activePane);
    const index = this.tabService.paneTabIndices[this.tabService.activePane];
    if (paneTabs.length > 0 && index >= 0 && index < paneTabs.length) {
      this.tabService.removeTab(index, this.tabService.activePane);
    }
  }

  private nextTab() {
    const paneTabs = this.tabService.getTabsForPane(this.tabService.activePane);
    if (paneTabs.length > 1) {
      const next = (this.tabService.paneTabIndices[this.tabService.activePane] + 1) % paneTabs.length;
      this.tabService.paneTabIndices[this.tabService.activePane] = next;
    }
  }

  private prevTab() {
    const paneTabs = this.tabService.getTabsForPane(this.tabService.activePane);
    if (paneTabs.length > 1) {
      const prev = (this.tabService.paneTabIndices[this.tabService.activePane] - 1 + paneTabs.length) % paneTabs.length;
      this.tabService.paneTabIndices[this.tabService.activePane] = prev;
    }
  }

  private closeMenu() {
    this.modalControl.closeModal();
    const idx = this.openStack.lastIndexOf('menu');
    if (idx >= 0) this.openStack.splice(idx, 1);
  }

  toggleMenu(menu: string) {
    if (this.modalControl.currentOpenedMenu === menu && this.modalControl.isMenuModalOpen) {
      this.closeMenu();
      return;
    }
    this.modalControl.closeModal();
    const idx = this.openStack.lastIndexOf('menu');
    if (idx >= 0) this.openStack.splice(idx, 1);
    this.modalControl.toggleMenu(menu);
    this.openStack.push('menu');
  }

  showShortcutHelp() {
    if (this.shortcutHelpRef) {
      this.shortcutHelpRef.close();
      this.shortcutHelpRef = null;
      return;
    }
    this.openStack.push('help');
    this.shortcutHelpRef = this.dialog.open(ShortcutHelpComponent, {
      width: '420px',
      panelClass: 'shortcut-help-dialog',
    });
    this.shortcutHelpRef.afterClosed().subscribe(() => {
      this.shortcutHelpRef = null;
      const idx = this.openStack.lastIndexOf('help');
      if (idx >= 0) this.openStack.splice(idx, 1);
    });
  }
}
