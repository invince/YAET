import { HttpClient } from '@angular/common/http';
import { Component, Input, OnDestroy, OnInit } from '@angular/core';
import { Session } from '../../../domain/session/Session';
import { SambaService } from '../../../services/file-explorer/samba.service';
import { TabService } from '../../../services/tab.service';
import { AbstractFileManager } from '../abstract-file-manager';
import { FileListComponent } from '../custom/file-list.component';

@Component({
    selector: 'app-samba',
    imports: [
        FileListComponent
    ],
    templateUrl: './samba.component.html',
    styleUrl: './samba.component.css'
})
export class SambaComponent extends AbstractFileManager implements OnInit, OnDestroy {

  @Input() public session!: Session;


  constructor(private sambaService: SambaService, http: HttpClient, private tabService: TabService) {
    super(http);
  }

  ngOnInit(): void {
    this.session.open();
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
    return this.sambaService.setup(this.session);
  }

}
