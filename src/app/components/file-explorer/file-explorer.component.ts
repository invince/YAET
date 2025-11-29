import {Component, Input} from '@angular/core';
import {ScpComponent} from "./scp/scp.component";
import {Session} from '../../domain/session/Session';
import {FtpComponent} from './ftp/ftp.component';
import {SambaComponent} from './samba/samba.component';

@Component({
    selector: 'app-file-explorer',
    imports: [
        ScpComponent,
        FtpComponent,
        SambaComponent,
    ],
    templateUrl: './file-explorer.component.html',
    styleUrl: './file-explorer.component.css'
})
export class FileExplorerComponent {
  @Input() session!: Session;
}
