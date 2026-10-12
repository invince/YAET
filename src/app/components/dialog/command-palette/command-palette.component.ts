import {CommonModule} from '@angular/common';
import {Component, ElementRef, NgZone, ViewChild} from '@angular/core';
import {FormsModule} from '@angular/forms';
import {MatButtonModule} from '@angular/material/button';
import {MatDialogModule, MatDialogRef} from '@angular/material/dialog';
import {MatIcon} from '@angular/material/icon';
import {TranslateModule} from '@ngx-translate/core';
import {Profile, ProfileCategory} from '../../../domain/profile/Profile';
import {MenuConsts} from '../../../domain/MenuConsts';
import {TabInstance} from '../../../domain/TabInstance';
import {AiChatService} from '../../../services/ai-chat.service';
import {MasterKeyService} from '../../../services/master-key.service';
import {NotificationService} from '../../../services/notification.service';
import {ProfileService} from '../../../services/profile.service';
import {SessionService} from '../../../services/session.service';
import {SettingService} from '../../../services/setting.service';
import {ShortcutService} from '../../../services/shortcut.service';
import {TabService} from '../../../services/tab.service';

export interface CommandPaletteItem {
  id: string;
  label: string;
  hint: string;
  group: string;
  icon: string;
  keywords: string;
  run: () => void;
}

@Component({
  selector: 'app-command-palette',
  standalone: true,
  imports: [CommonModule, FormsModule, MatDialogModule, MatButtonModule, MatIcon, TranslateModule],
  templateUrl: './command-palette.component.html',
  styleUrl: './command-palette.component.scss'
})
export class CommandPaletteComponent {

  @ViewChild('filterInput') filterInput!: ElementRef<HTMLInputElement>;

  query = '';
  items: CommandPaletteItem[] = [];
  filtered: CommandPaletteItem[] = [];
  selectedIndex = 0;

  private groups: { key: string, label: string }[] = [
    { key: 'PROFILE', label: 'Profiles' },
    { key: 'TAB', label: 'Open Tabs' },
    { key: 'ACTION', label: 'Actions' },
  ];

  constructor(
    private dialogRef: MatDialogRef<CommandPaletteComponent>,
    private shortcutService: ShortcutService,
    private profileService: ProfileService,
    private tabService: TabService,
    private sessionService: SessionService,
    private settingService: SettingService,
    private masterKeyService: MasterKeyService,
    private notification: NotificationService,
    private aiChatService: AiChatService,
    private ngZone: NgZone,
  ) {
    this.items = this.buildItems();
    this.applyFilter();
  }

  groupLabelKey(key: string): string {
    return `COMMAND_PALETTE.GROUP_${key}`;
  }

  /**
   * Groups are rendered in a fixed order, so the filtered list has to be kept
   * sorted the same way — otherwise a profile match would appear under the
   * "Actions" header.
   */
  grouped(): { item: CommandPaletteItem, index: number }[] {
    const result: { item: CommandPaletteItem, index: number }[] = [];
    for (const group of this.groups) {
      this.filtered.forEach((item, index) => {
        if (item.group === group.key) result.push({ item, index });
      });
    }
    return result;
  }

  private buildItems(): CommandPaletteItem[] {
    const items: CommandPaletteItem[] = [];

    for (const profile of this.profileService.profilesCopy.profiles) {
      items.push({
        id: `profile-${profile.id}`,
        label: profile.name,
        hint: this.profileHint(profile),
        group: 'PROFILE',
        icon: profile.icon || 'terminal',
        keywords: `${profile.profileType} ${profile.comment ?? ''}`,
        run: () => {
          this.ngZone.run(() => this.profileService.onProfileConnect(profile));
        }
      });
    }

    this.tabService.tabs.forEach(tab => {
      const paneTabs = this.tabService.getTabsForPane(tab.paneId);
      const indexInPane = paneTabs.indexOf(tab);
      items.push({
        id: `tab-${tab.id}`,
        label: tab.name,
        hint: 'Switch to tab',
        group: 'TAB',
        icon: 'tab',
        keywords: tab.category,
        run: () => {
          this.ngZone.run(() => {
            this.tabService.activePane = tab.paneId;
            if (indexInPane >= 0) {
              this.tabService.paneTabIndices[tab.paneId] = indexInPane;
            }
          });
        }
      });
    });

    const actions: CommandPaletteItem[] = [
      {
        id: 'action-new-terminal',
        label: 'New Local Terminal',
        hint: 'Ctrl+Shift+N',
        group: 'ACTION',
        icon: 'add',
        keywords: 'local shell bash powershell cmd',
        run: () => this.ngZone.run(() => this.newLocalTerminal())
      },
      {
        id: 'action-quick-connect',
        label: 'Quick Connect',
        hint: 'Ctrl+Shift+Q',
        group: 'ACTION',
        icon: 'bolt',
        keywords: 'new connection profile',
        run: () => this.ngZone.run(() => this.shortcutService.toggleMenu(MenuConsts.MENU_ADD))
      },
      {
        id: 'action-profiles',
        label: 'Show Profiles',
        hint: 'Ctrl+Shift+P',
        group: 'ACTION',
        icon: 'list',
        keywords: 'profiles tree groups',
        run: () => this.ngZone.run(() => this.shortcutService.toggleMenu(MenuConsts.MENU_PROFILE))
      },
      {
        id: 'action-secrets',
        label: 'Show Secrets',
        hint: 'Ctrl+Shift+S',
        group: 'ACTION',
        icon: 'lock',
        keywords: 'passwords keys secrets',
        run: () => this.ngZone.run(() => this.shortcutService.toggleMenu(MenuConsts.MENU_SECURE))
      },
      {
        id: 'action-proxies',
        label: 'Show Proxies',
        hint: 'Proxies',
        group: 'ACTION',
        icon: 'vpn_lock',
        keywords: 'proxy socks http',
        run: () => this.ngZone.run(() => this.shortcutService.toggleMenu(MenuConsts.MENU_PROXY))
      },
      {
        id: 'action-settings',
        label: 'Show Settings',
        hint: 'Ctrl+Shift+,',
        group: 'ACTION',
        icon: 'settings',
        keywords: 'preferences options',
        run: () => this.ngZone.run(() => this.shortcutService.toggleMenu(MenuConsts.MENU_SETTING))
      },
      {
        id: 'action-ai-chat',
        label: 'Toggle AI Chat',
        hint: 'Ctrl+Shift+I',
        group: 'ACTION',
        icon: 'smart_toy',
        keywords: 'assistant ai agent llm',
        run: () => this.ngZone.run(() => this.aiChatService.toggle())
      },
      {
        id: 'action-split-vertical',
        label: 'Toggle Vertical Split',
        hint: 'Split view',
        group: 'ACTION',
        icon: 'vertical_split',
        keywords: 'split pane view',
        run: () => this.ngZone.run(() => this.tabService.toggleSplit('vertical'))
      },
      {
        id: 'action-split-horizontal',
        label: 'Toggle Horizontal Split',
        hint: 'Split view',
        group: 'ACTION',
        icon: 'horizontal_split',
        keywords: 'split pane view',
        run: () => this.ngZone.run(() => this.tabService.toggleSplit('horizontal'))
      },
      {
        id: 'action-close-tab',
        label: 'Close Current Tab',
        hint: 'Ctrl+Shift+W',
        group: 'ACTION',
        icon: 'close',
        keywords: 'close tab session',
        run: () => this.ngZone.run(() => this.closeCurrentTab())
      },
      {
        id: 'action-next-tab',
        label: 'Next Tab',
        hint: 'Ctrl+Tab',
        group: 'ACTION',
        icon: 'navigate_next',
        keywords: 'switch tab',
        run: () => this.ngZone.run(() => this.cycleTab(1))
      },
      {
        id: 'action-prev-tab',
        label: 'Previous Tab',
        hint: 'Ctrl+Shift+Tab',
        group: 'ACTION',
        icon: 'navigate_before',
        keywords: 'switch tab',
        run: () => this.ngZone.run(() => this.cycleTab(-1))
      },
      {
        id: 'action-shortcuts',
        label: 'Keyboard Shortcuts',
        hint: 'Ctrl+Shift+H',
        group: 'ACTION',
        icon: 'keyboard',
        keywords: 'help hotkeys',
        run: () => this.ngZone.run(() => this.shortcutService.showShortcutHelp())
      },
    ];
    items.push(...actions);

    return items;
  }

  private profileHint(profile: Profile): string {
    const category = profile.category === ProfileCategory.TERMINAL ? 'Terminal'
      : profile.category === ProfileCategory.FILE_EXPLORER ? 'Files'
        : profile.category === ProfileCategory.REMOTE_DESKTOP ? 'Desktop' : 'Custom';
    return `${category} · ${profile.profileType}`;
  }

  private newLocalTerminal() {
    if (!this.masterKeyService.hasMasterKey) {
      this.notification.info('Please define Master key in Settings first');
      return;
    }
    const profile = this.settingService.createLocalTerminalProfile();
    const tab = new TabInstance(ProfileCategory.TERMINAL, this.sessionService.create(profile, profile.profileType));
    this.tabService.addTab(tab);
  }

  private closeCurrentTab() {
    const paneId = this.tabService.activePane;
    const paneTabs = this.tabService.getTabsForPane(paneId);
    const index = this.tabService.paneTabIndices[paneId];
    if (paneTabs.length > 0 && index >= 0 && index < paneTabs.length) {
      this.tabService.removeTab(index, paneId);
    }
  }

  private cycleTab(direction: 1 | -1) {
    const paneTabs = this.tabService.getTabsForPane(this.tabService.activePane);
    if (paneTabs.length > 1) {
      const current = this.tabService.paneTabIndices[this.tabService.activePane];
      const next = (current + direction + paneTabs.length) % paneTabs.length;
      this.tabService.paneTabIndices[this.tabService.activePane] = next;
    }
  }

  applyFilter() {
    const query = this.query.trim().toLowerCase();
    if (!query) {
      this.filtered = [...this.items];
      this.selectedIndex = 0;
      return;
    }
    const scored: { item: CommandPaletteItem, score: number }[] = [];
    for (const item of this.items) {
      const score = this.fuzzyScore(query, item.label) ?? this.fuzzyScore(query, `${item.keywords} ${item.hint}`);
      if (score !== null) scored.push({ item, score });
    }
    scored.sort((a, b) => b.score - a.score);
    this.filtered = scored.map(entry => entry.item);
    this.selectedIndex = 0;
  }

  /**
   * Subsequence fuzzy match. Returns null when the query is not a subsequence of
   * the text, otherwise a score (higher = better). Consecutive and
   * word-start matches are rewarded so "pven" ranks "0 PVE Nuc" first.
   */
  private fuzzyScore(query: string, text: string): number | null {
    const haystack = text.toLowerCase();
    let score = 0;
    let position = 0;
    let previousMatch = -2;
    for (const char of query) {
      const found = haystack.indexOf(char, position);
      if (found === -1) return null;
      if (found === previousMatch + 1) score += 8;
      if (found === 0 || /[\s\-_./]/.test(haystack[found - 1] ?? '')) score += 6;
      score += 1;
      previousMatch = found;
      position = found + 1;
    }
    // Shorter labels rank above longer ones for the same match quality
    score += Math.max(0, 20 - haystack.length / 4);
    return score;
  }

  highlight(label: string): string {
    const query = this.query.trim();
    if (!query) return this.escape(label);
    const index = label.toLowerCase().indexOf(query.toLowerCase());
    if (index < 0) return this.escape(label);
    return this.escape(label.substring(0, index))
      + '<mark>' + this.escape(label.substring(index, index + query.length)) + '</mark>'
      + this.escape(label.substring(index + query.length));
  }

  private escape(value: string): string {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  onKeydown(event: KeyboardEvent) {
    if (event.key === 'ArrowDown' || (event.key === 'n' && event.ctrlKey)) {
      event.preventDefault();
      this.moveSelection(1);
    } else if (event.key === 'ArrowUp' || (event.key === 'p' && event.ctrlKey)) {
      event.preventDefault();
      this.moveSelection(-1);
    } else if (event.key === 'Home') {
      event.preventDefault();
      this.selectedIndex = 0;
    } else if (event.key === 'End') {
      event.preventDefault();
      this.selectedIndex = Math.max(0, this.filtered.length - 1);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      this.runSelected();
    }
  }

  private moveSelection(delta: number) {
    if (this.filtered.length === 0) return;
    this.selectedIndex = (this.selectedIndex + delta + this.filtered.length) % this.filtered.length;
  }

  runSelected() {
    const item = this.filtered[this.selectedIndex];
    if (!item) return;
    this.dialogRef.close();
    item.run();
  }

  select(item: CommandPaletteItem, index: number) {
    this.selectedIndex = index;
    this.runSelected();
  }

  ngAfterViewInit() {
    setTimeout(() => this.filterInput?.nativeElement?.focus(), 0);
  }
}
