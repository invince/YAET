import {Component, Input} from '@angular/core';
import {ScpComponent} from "./scp/scp.component";
import {Session} from '../../domain/session/Session';

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
  @Input() session!: Session;
}
