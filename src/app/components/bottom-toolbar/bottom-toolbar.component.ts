import {CommonModule} from '@angular/common';
import {Component} from '@angular/core';
import {ToolbarModule} from 'primeng/toolbar';
import {ButtonModule} from 'primeng/button';
import {AiChatService} from '../../services/ai-chat.service';
import {SettingStorageService} from '../../services/setting-storage.service';
import {TabService} from '../../services/tab.service';

@Component({
    selector: 'app-bottom-toolbar',
    imports: [CommonModule, ToolbarModule, ButtonModule],
    templateUrl: './bottom-toolbar.component.html',
    styleUrls: ['./bottom-toolbar.component.css']
})
export class BottomToolbarComponent {
    constructor(
        public tabService: TabService,
        public aiChatService: AiChatService,
        private settingStorage: SettingStorageService
    ) { }

    get isAiConfigured(): boolean {
        const ai = this.settingStorage.settings.ai;
        return !!(ai && ai.apiUrl && ai.token);
    }

    toggleSplit(direction: 'vertical' | 'horizontal' = 'vertical', ratio: number = 50) {
        this.tabService.toggleSplit(direction, ratio);
    }

    toggleAi() {
        this.aiChatService.toggle();
    }
}
