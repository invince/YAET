import { HttpClient } from '@angular/common/http';
import { Component, Input, OnDestroy, OnInit } from '@angular/core';
import { Session } from '../../../domain/session/Session';
import { FtpService } from '../../../services/file-explorer/ftp.service';
import { AbstractFileManager } from '../abstract-file-manager';
import { FileListComponent } from '../custom/file-list.component';

@Component({
  selector: 'app-ftp',
  standalone: true,
  imports: [
    FileListComponent
  ],
  templateUrl: './ftp.component.html',
  styleUrl: './ftp.component.css'
})
export class FtpComponent extends AbstractFileManager implements OnInit, OnDestroy {

  @Input() public session!: Session;


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
    return this.path;
  }

  generateAjaxSettings(): any {
    return this.ftpService.setup(this.session);
  }
}

