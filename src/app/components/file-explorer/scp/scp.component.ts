import {AfterViewInit, Component, Input, OnInit} from '@angular/core';
import {FileManagerAllModule, FileManagerModule} from '@syncfusion/ej2-angular-filemanager';
import {TabInstance} from '../../../domain/TabInstance';
import {ScpService} from '../../../services/scp.service';
import {AuthType} from '../../../domain/Secret';


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
export class ScpComponent implements OnInit{

  @Input() tab!: TabInstance;

  public ajaxSettings = {};
  public navigationPaneSettings = {
    visible: true, // Show navigation pane
    maxWidth: '150px', // Set width of the navigation pane
    minWidth: '50px', // Set width of the navigation pane
  };


  public toolbarSettings = {
    visible: true, // Show toolbar
  };
  constructor(private scpService: ScpService) {
  }
  ngOnInit(): void {

    this.scpService.connect(this.tab.id, this.tab.profile.sshProfile).then(
      () => this.tab.connected = true
    );

    this.ajaxSettings = {
      url: 'http://localhost:3000/api/v1/scp/' + this.tab.id, // Custom backend API
      uploadUrl: 'http://localhost:3000/api/v1/scp/upload/' + this.tab.id , // Custom upload endpoint
      downloadUrl: 'http://localhost:3000/api/v1/scp/download/' + this.tab.id, // Custom download endpoint
    }
  }

}
