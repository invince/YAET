import {HttpClient} from '@angular/common/http';
import {Component, Input, OnDestroy, OnInit} from '@angular/core';
import {Session} from '../../../../src/app/domain/session/Session';
import {ScpService} from '../services/scp.service';
import {TabService} from '../../../../src/app/services/tab.service';
import {AbstractFileManager} from '../../../../src/app/components/file-explorer/abstract-file-manager';
import {FileListComponent} from '../../../../src/app/components/file-explorer/custom/file-list.component';

@Component({
    selector: 'app-scp',
    imports: [
        FileListComponent
    ],
    templateUrl: './scp.component.html',
    styleUrl: './scp.component.scss'
})
export class ScpComponent extends AbstractFileManager implements OnInit, OnDestroy {

  @Input() public session!: Session;


  constructor(private scpService: ScpService, http: HttpClient, private tabService: TabService) {
    super(http);
  }

  ngOnInit(): void {
    this.session.open();

    const sshProfile = this.session.profile?.getProfile('SSH_TERMINAL');
    if (sshProfile?.initPath) {
      this.path = sshProfile.initPath;
    }
    this.ajaxSettings = this.generateAjaxSettings();
  }


  ngOnDestroy(): void {
    const isTabStillActive = this.tabService.tabs.some(t => t.id === this.session.id);
    if (!isTabStillActive) {
      this.session.close();
    }
  }

  generateAjaxSettings(): any {
    return this.scpService.setup(this.session);
  }

  getCurrentPath(): string | undefined {
    return this.path;
  }


}
