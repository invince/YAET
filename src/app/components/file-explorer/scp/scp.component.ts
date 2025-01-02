import {Component, Input, OnDestroy, OnInit} from '@angular/core';
import {FileManagerAllModule, FileManagerModule} from '@syncfusion/ej2-angular-filemanager';
import {ScpService} from '../../../services/scp.service';
import {TabService} from '../../../services/tab.service';
import {Session} from '../../../domain/session/Session';


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
export class ScpComponent implements OnInit, OnDestroy{

  @Input() session!: Session;

  path:string = '/';

  public ajaxSettings = {};
  public navigationPaneSettings = {
    visible: true, // Show navigation pane
    maxWidth: '150px', // Set width of the navigation pane
    minWidth: '50px', // Set width of the navigation pane
  };


  public toolbarSettings = {
    visible: true, // Show toolbar
  };
  constructor(private scpService: ScpService,
              private tabService: TabService) {
  }
  ngOnInit(): void {

   this.session.open();

    if (this.session.profile.sshProfile?.initPath) {
      this.path = this.session.profile.sshProfile.initPath;
    }


    this.ajaxSettings = {
      url: 'http://localhost:3000/api/v1/scp/' + this.session.id, // Custom backend API
      uploadUrl: 'http://localhost:3000/api/v1/scp/upload/' + this.session.id , // Custom upload endpoint
      downloadUrl: 'http://localhost:3000/api/v1/scp/download/' + this.session.id, // Custom download endpoint
    }
  }

  ngOnDestroy(): void {
    this.session.close();
  }

}