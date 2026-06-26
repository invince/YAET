import {HttpClient} from '@angular/common/http';
import {Component, Input, OnDestroy, OnInit} from '@angular/core';
import {Session} from '../../domain/session/Session';
import {TabService} from '../../services/tab.service';
import {AbstractFileManager} from './abstract-file-manager';
import {FileListComponent} from './custom/file-list.component';
import {NODE_EXPRESS_API_ROOT} from '../../services/electron/ElectronConstant';
import {NgIf} from '@angular/common';

@Component({
    selector: 'app-external-file-explorer',
    imports: [
        NgIf,
        FileListComponent,
    ],
    template: `
    <app-file-list *ngIf="sessionReady" [ajaxSettings]="ajaxSettings" [path]="path" (pathChange)="path = $event" [session]="session"></app-file-list>
  `,
})
export class ExternalFileExplorerComponent extends AbstractFileManager implements OnInit, OnDestroy {

  @Input() session!: Session;
  sessionReady = false;

  constructor(http: HttpClient, private tabService: TabService) {
    super(http);
  }

  async ngOnInit(): Promise<void> {
    await this.session.open();
    this.ajaxSettings = this.generateAjaxSettings();
    this.sessionReady = true;
  }

  ngOnDestroy(): void {
    const isTabStillActive = this.tabService.tabs.some(t => t.id === this.session.id);
    if (!isTabStillActive) {
      this.session.close();
    }
  }

  generateAjaxSettings(): any {
    const apiPath = getExternalPluginApiPath(this.session.profileType);
    const base = `${NODE_EXPRESS_API_ROOT}/v1/${apiPath}`;
    return {
      url: `${base}/${this.session.id}`,
      uploadUrl: `${base}/upload/${this.session.id}`,
      downloadUrl: `${base}/download/${this.session.id}`,
      openUrl: `${base}/open/${this.session.id}`,
    };
  }

  getCurrentPath(): string | undefined {
    return this.path;
  }
}

export function getExternalPluginApiPath(profileType: string): string {
  return profileType.replace(/_FILE_EXPLORER$/i, '').toLowerCase().replace(/_/g, '-');
}
