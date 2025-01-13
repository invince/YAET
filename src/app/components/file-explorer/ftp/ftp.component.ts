import {
  Component,
  Input,
  OnDestroy, OnInit, ViewChild,
} from '@angular/core';
import {Session} from '../../../domain/session/Session';
import {ScpService} from '../../../services/scp.service';
import {FileManager, FileManagerModule} from '@syncfusion/ej2-angular-filemanager';
import {FtpService} from '../../../services/ftp.service';

@Component({
  selector: 'app-ftp',
  standalone: true,
  imports: [
    FileManagerModule
  ],
  templateUrl: './ftp.component.html',
  styleUrl: './ftp.component.css'
})
export class FtpComponent implements OnInit, OnDestroy{

  @Input() session!: Session;

  path:string = '/';

  public ajaxSettings = {};
  public navigationPaneSettings = {
    visible: true, // Show navigation pane
    maxWidth: '150px', // Set width of the navigation pane
    minWidth: '50px', // Set width of the navigation pane
  };

  public contextMenuSettings = {
    file: ['Open', '|', 'Delete', 'Rename'],
    folder: ['Open', '|', 'Delete', 'Rename'],
    layout: ['SortBy', 'View', 'Refresh', 'NewFolder', 'Upload', '|', 'SelectAll'],
    visible: true
  };


  public toolbarSettings = {
    items: ['NewFolder', 'Upload', 'Delete', 'Download', 'Rename', 'SortBy', 'Refresh', 'Selection', 'View'],
    visible: true, // Show toolbar
  };

  constructor(private ftpService: FtpService) {
  }

  ngOnInit(): void {

    this.session.open();

    if (this.session.profile.ftpProfile?.initPath) {
      this.path = this.session.profile.ftpProfile.initPath;
    }


    this.ajaxSettings = this.ftpService.setup(this.session);
  }

  ngOnDestroy(): void {
    this.session.close();
  }

}

