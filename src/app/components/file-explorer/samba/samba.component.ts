import {Component, Input, OnDestroy, OnInit, ViewChild} from '@angular/core';
import {FileManagerComponent, FileManagerModule} from "@syncfusion/ej2-angular-filemanager";
import {AbstractFileManager} from '../abstract-file-manager';
import {Session} from '../../../domain/session/Session';
import {HttpClient} from '@angular/common/http';
import {SambaService} from '../../../services/file-explorer/samba.service';

@Component({
  selector: 'app-samba',
  standalone: true,
    imports: [
        FileManagerModule
    ],
  templateUrl: './samba.component.html',
  styleUrl: './samba.component.css'
})
export class SambaComponent extends AbstractFileManager implements OnInit, OnDestroy{

  @Input() public session!: Session;
  @ViewChild('fileManager', { static: false })
  public fileManager?: FileManagerComponent;

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
    return this.fileManager?.path;
  }

  generateAjaxSettings(): any {
    return this.sambaService.setup(this.session);
  }


  test($event: any) {
    console.log($event);
  }

}
