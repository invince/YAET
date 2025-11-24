import { HttpClient } from '@angular/common/http';
import { Component, Input, OnDestroy, OnInit } from '@angular/core';
import { Session } from '../../../domain/session/Session';
import { ScpService } from '../../../services/file-explorer/scp.service';
import { AbstractFileManager } from '../abstract-file-manager';
import { FileListComponent } from '../custom/file-list.component';

@Component({
  selector: 'app-scp',
  standalone: true,
  imports: [
    FileListComponent
  ],
  templateUrl: './scp.component.html',
  styleUrl: './scp.component.css'
})
export class ScpComponent extends AbstractFileManager implements OnInit, OnDestroy {

  @Input() public session!: Session;


  constructor(private scpService: ScpService, http: HttpClient) {
    super(http);
  }

  ngOnInit(): void {
    this.session.open();

    if (this.session.profile?.sshProfile?.initPath) {
      this.path = this.session.profile.sshProfile.initPath;
    }
    this.ajaxSettings = this.generateAjaxSettings();
  }


  ngOnDestroy(): void {
    this.session.close();
  }

  generateAjaxSettings(): any {
    return this.scpService.setup(this.session);
  }

  getCurrentPath(): string | undefined {
    return this.path;
  }
}
