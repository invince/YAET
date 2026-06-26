import {HttpClient} from '@angular/common/http';
import {Component, Input, OnDestroy, OnInit} from '@angular/core';
import {Session} from '../../../../src/app/domain/session/Session';
import {FtpService} from '../services/ftp.service';
import {TabService} from '../../../../src/app/services/tab.service';
import {AbstractFileManager} from '../../../../src/app/components/file-explorer/abstract-file-manager';
import {FileListComponent} from '../../../../src/app/components/file-explorer/custom/file-list.component';

@Component({
    selector: 'app-ftp',
    imports: [
        FileListComponent
    ],
    templateUrl: './ftp.component.html',
    styleUrl: './ftp.component.scss'
})
export class FtpComponent extends AbstractFileManager implements OnInit, OnDestroy {

  @Input() public session!: Session;


  constructor(private ftpService: FtpService, http: HttpClient, private tabService: TabService) {
    super(http);
  }

  ngOnInit(): void {
    this.session.open();
    const ftpProfile = this.session.profile?.getProfile('FTP_FILE_EXPLORER');
    if (ftpProfile?.initPath) {
      this.path = ftpProfile.initPath;
    }
    this.ajaxSettings = this.generateAjaxSettings();
  }

  ngOnDestroy(): void {
    const isTabStillActive = this.tabService.tabs.some(t => t.id === this.session.id);
    if (!isTabStillActive) {
      this.session.close();
    }
  }

  getCurrentPath(): string | undefined {
    return this.path;
  }

  generateAjaxSettings(): any {
    return this.ftpService.setup(this.session);
  }
}