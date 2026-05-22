import { Component } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule } from '@angular/material/dialog';
import { MatIcon } from '@angular/material/icon';
import { TranslateModule } from '@ngx-translate/core';

const isMac = navigator.platform.toUpperCase().includes('MAC');
const mod = isMac ? '⌘' : 'Ctrl';

@Component({
  selector: 'app-shortcut-help',
  standalone: true,
  imports: [MatDialogModule, MatButtonModule, MatIcon, TranslateModule],
  templateUrl: './shortcut-help.component.html',
  styleUrl: './shortcut-help.component.scss'
})
export class ShortcutHelpComponent {
  shortcuts = [
    { keys: `${mod}+Shift+N`, action: 'SHORTCUTS.NEW_TERMINAL' },
    { keys: `${mod}+Shift+W`, action: 'SHORTCUTS.CLOSE_TAB' },
    { keys: `${mod}+Tab`, action: 'SHORTCUTS.NEXT_TAB' },
    { keys: `${mod}+Shift+Tab`, action: 'SHORTCUTS.PREV_TAB' },
    { keys: `${mod}+Shift+Q`, action: 'SHORTCUTS.QUICK_CONNECT' },
    { keys: `${mod}+Shift+P`, action: 'SHORTCUTS.TOGGLE_PROFILES' },
    { keys: `${mod}+Shift+S`, action: 'SHORTCUTS.TOGGLE_SECRETS' },
    { keys: `${mod}+Shift+,`, action: 'SHORTCUTS.TOGGLE_SETTINGS' },
    { keys: `${mod}+Shift+I`, action: 'SHORTCUTS.TOGGLE_AI_CHAT' },
  ];
}
