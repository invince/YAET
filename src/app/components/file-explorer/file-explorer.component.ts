import {Component, Input, ViewChild} from '@angular/core';
import {TabInstance} from '../../domain/TabInstance';
import {NgTerminal} from 'ng-terminal';

@Component({
  selector: 'app-file-explorer',
  standalone: true,
  imports: [],
  templateUrl: './file-explorer.component.html',
  styleUrl: './file-explorer.component.css'
})
export class FileExplorerComponent {
  @Input() tab!: TabInstance;
}
