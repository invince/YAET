import {Component, Input, ViewChild} from '@angular/core';
import {TabInstance} from '../../domain/TabInstance';
import {NgTerminal} from 'ng-terminal';
import {ScpComponent} from "./scp/scp.component";

@Component({
  selector: 'app-file-explorer',
  standalone: true,
    imports: [
        ScpComponent
    ],
  templateUrl: './file-explorer.component.html',
  styleUrl: './file-explorer.component.css'
})
export class FileExplorerComponent {
  @Input() tab!: TabInstance;
}
