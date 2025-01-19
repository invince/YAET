import {Component, Input, OnDestroy, OnInit, ViewChild} from '@angular/core';
import {
  FileManagerAllModule,
  FileManagerComponent,
  FileManagerModule,
  ToolbarClickEventArgs
} from '@syncfusion/ej2-angular-filemanager';
import {ScpService} from '../../../services/scp.service';
import {Session} from '../../../domain/session/Session';
import {AbstractFileManager} from '../abstract-file-manager';
import {HttpClient} from '@angular/common/http';


@Component({
  selector: 'app-scp',
  standalone: true,
  imports: [
    FileManagerModule,
    FileManagerAllModule,
  ],
  templateUrl: './scp.component.html',
  styleUrl: './scp.component.css'
})
export class ScpComponent extends AbstractFileManager implements OnInit, OnDestroy{

  @Input() public session!: Session;
  @ViewChild('fileManager', { static: false })
  public fileManager?: FileManagerComponent;

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
    return this.fileManager?.path;
  }


  onToolbarClick(args: ToolbarClickEventArgs | any) {
    if (args.item?.properties?.text === 'Copy Path') {
      navigator.clipboard.writeText(this.path);
    }
  }
}
