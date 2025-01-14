import {
  Component,
  Input,
  OnDestroy, OnInit, ViewChild,
} from '@angular/core';
import {Session} from '../../../domain/session/Session';
import {FileManagerComponent, FileManagerModule} from '@syncfusion/ej2-angular-filemanager';
import {FtpService} from '../../../services/ftp.service';
import {HttpClient} from '@angular/common/http';

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
  @ViewChild('fileManager', { static: false })
  public fileManager?: FileManagerComponent;

  path:string = '/';

  public ajaxSettings: any = {};
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

  constructor(private ftpService: FtpService, private http: HttpClient) {
  }

  ngOnInit(): void {

    this.session.open();

    if (this.session.profile?.ftpProfile?.initPath) {
      this.path = this.session.profile.ftpProfile.initPath;
    }


    this.ajaxSettings = this.ftpService.setup(this.session);
  }

  ngOnDestroy(): void {
    this.session.close();
  }

  onFileOpen(args: any): void {
    if (args.fileDetails.isFile) {
      const fileName = args.fileDetails.name;
      const currentPath = this.fileManager?.path; // Get the current directory path
      const downloadPayload = {
        path: currentPath + fileName,
      };

      this.downloadFile(downloadPayload);
    }
  }

  downloadFile(payload: any): void {

    this.http
      .post(payload.path, { downloadInput: JSON.stringify(payload) }, { responseType: 'blob' })
      .subscribe((response: Blob) => {
        // Create a URL for the blob and trigger the download
        const blobUrl = window.URL.createObjectURL(response);
        const a = document.createElement('a');
        a.href = blobUrl;
        a.download = payload.names[0]; // Set the file name
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(blobUrl); // Cleanup
      });
  }




  fileOpen(args: any) {
    if (args.fileDetails.isFile) {
      const file = args.fileDetails;
      const downloadUrl = `${this.ajaxSettings.downloadUrl}?path=${file.path}`;

      // Trigger download
      window.open(downloadUrl, '_blank');
    }
  }
}

