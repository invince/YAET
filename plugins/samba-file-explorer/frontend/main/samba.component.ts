import {HttpClient} from '@angular/common/http';
import {Component, Input, OnDestroy, OnInit} from '@angular/core';
import {Session} from '../../../../src/app/domain/session/Session';
import {SambaService} from '../services/samba.service';
import {TabService} from '../../../../src/app/services/tab.service';
import {AbstractFileManager} from '../../../../src/app/components/file-explorer/abstract-file-manager';
import {FileListComponent} from '../../../../src/app/components/file-explorer/custom/file-list.component';

@Component({
    selector: 'app-samba',
    imports: [
        FileListComponent
    ],
    templateUrl: './samba.component.html',
    styleUrl: './samba.component.scss'
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
