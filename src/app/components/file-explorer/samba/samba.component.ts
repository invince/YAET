import { HttpClient } from '@angular/common/http';
import { Component, Input, OnDestroy, OnInit } from '@angular/core';
import { Session } from '../../../domain/session/Session';
import { SambaService } from '../../../services/file-explorer/samba.service';
import { AbstractFileManager } from '../abstract-file-manager';
import { FileListComponent } from '../custom/file-list.component';

@Component({
  selector: 'app-samba',
  standalone: true,
  imports: [
    FileListComponent
  ],
  templateUrl: './samba.component.html',
  styleUrl: './samba.component.css'
})
export class SambaComponent extends AbstractFileManager implements OnInit, OnDestroy {

  @Input() public session!: Session;


  constructor(private sambaService: SambaService, http: HttpClient) {
    super(http);
  }

  ngOnInit(): void {
    this.session.open();
    this.ajaxSettings = this.generateAjaxSettings();
  }

  ngOnDestroy(): void {
    this.session.close();
  }

  getCurrentPath(): string | undefined {
    return this.path;
  }

  generateAjaxSettings(): any {
    return this.sambaService.setup(this.session);
  }

}
