import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatToolbarModule } from '@angular/material/toolbar';
import { TabService } from '../../services/tab.service';

@Component({
    selector: 'app-bottom-toolbar',
    imports: [CommonModule, MatToolbarModule, MatButtonModule, MatIconModule],
    templateUrl: './bottom-toolbar.component.html',
    styleUrls: ['./bottom-toolbar.component.css']
})
export class BottomToolbarComponent {
    constructor(public tabService: TabService) { }

    toggleSplit(direction: 'vertical' | 'horizontal' = 'vertical', ratio: number = 50) {
        this.tabService.toggleSplit(direction, ratio);
    }
}
