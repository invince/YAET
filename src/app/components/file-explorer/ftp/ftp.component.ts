import {Component, Input, OnDestroy, OnInit, ViewChild,} from '@angular/core';
import {Session} from '../../../domain/session/Session';
import {FileManagerComponent, FileManagerModule} from '@syncfusion/ej2-angular-filemanager';
import {FtpService} from '../../../services/file-explorer/ftp.service';
import {HttpClient} from '@angular/common/http';
import {AbstractFileManager} from '../abstract-file-manager';

@Component({
  selector: 'app-ftp',
  standalone: true,
  imports: [
    FileManagerModule
  ],
  templateUrl: './ftp.component.html',
  styleUrl: './ftp.component.css'
})
export class FtpComponent extends AbstractFileManager implements OnInit, OnDestroy{

  @Input() public session!: Session;
  @ViewChild('fileManager', { static: false })
  public fileManager?: FileManagerComponent;

  constructor(private ftpService: FtpService, http: HttpClient) {
    super(http);
  }

  ngOnInit(): void {
    this.session.open();
    if (this.session.profile?.ftpProfile?.initPath) {
      this.path = this.session.profile.ftpProfile.initPath;
    }
    this.ajaxSettings = this.generateAjaxSettings();
  }

  ngOnDestroy(): void {
    this.session.close();
  }

  getCurrentPath(): string | undefined {
    return this.fileManager?.path;
  }

  generateAjaxSettings(): any {
    return this.ftpService.setup(this.session);
  }

  protected override generateToolbarSettings() {
    return {
      items: ['NewFolder', 'Upload', 'Delete', 'Download', 'Rename', 'SortBy', 'Refresh', 'Selection', 'View'],
      visible: true, // Show toolbar
    };
  }

  protected override generateContextMenuSettings() {
    return {
      file: ['Open', '|', 'Delete', 'Rename'],
      folder: ['Open', '|', 'Delete', 'Rename'],
      layout: ['SortBy', 'View', 'Refresh', 'NewFolder', 'Upload', '|', 'SelectAll'],
      visible: true
    };
  }
}

