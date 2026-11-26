import {CommonModule} from '@angular/common';
import {Component} from '@angular/core';
import {Observable} from 'rxjs';
import {MatButtonModule} from '@angular/material/button';
import {MatIconModule} from '@angular/material/icon';
import {MatToolbarModule} from '@angular/material/toolbar';
import {AiChatService} from '../../services/ai-chat.service';
import {SettingStorageService} from '../../services/setting-storage.service';
import {SshMetrics, SshMetricsService} from '../../services/ssh-metrics.service';
import {TabService} from '../../services/tab.service';

@Component({
    selector: 'app-bottom-toolbar',
    imports: [CommonModule, MatToolbarModule, MatButtonModule, MatIconModule],
    templateUrl: './bottom-toolbar.component.html',
    styleUrls: ['./bottom-toolbar.component.scss']
})
export class BottomToolbarComponent {
    readonly metrics$: Observable<SshMetrics | null>;

    constructor(
        public tabService: TabService,
        public aiChatService: AiChatService,
        private settingStorage: SettingStorageService,
        metricsService: SshMetricsService,
    ) {
        this.metrics$ = metricsService.metrics$;
    }

    /** Whole-percent label; em dash until the first sample lands. */
    formatMetric(value: number | null): string {
        return value == null ? '—' : `${Math.round(value)}%`;
    }

    /** Colour band for a metric: normal below 70, amber 70-89, red >= 90. */
    metricLevel(value: number | null): 'ok' | 'warn' | 'crit' {
        if (value == null) return 'ok';
        if (value >= 90) return 'crit';
        if (value >= 70) return 'warn';
        return 'ok';
    }

    get isAiConfigured(): boolean {
        const ai = this.settingStorage.settings.ai;
        if (!ai) return false;
        if (ai.mode === 'acp' || (!ai.mode && ai.acpCommand)) {
            return !!(ai.acpCommand);
        }
        return !!(ai.apiUrl && ai.token);
    }

    toggleSplit(direction: 'vertical' | 'horizontal' = 'vertical', ratio: number = 50) {
        this.tabService.toggleSplit(direction, ratio);
    }

    toggleAi() {
        this.aiChatService.toggle();
    }
}
