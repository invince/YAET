import {Component, Input, ViewChild} from '@angular/core';
import {TabInstance} from '../../domain/TabInstance';
import {NgTerminal} from 'ng-terminal';
import {VncComponent} from "./vnc/vnc.component";
import {VncProfile} from '../../domain/profile/VncProfile';
import {Profile} from '../../domain/profile/Profile';

@Component({
  selector: 'app-remote-desktop',
  standalone: true,
    imports: [
        VncComponent
    ],
  templateUrl: './remote-desktop.component.html',
  styleUrl: './remote-desktop.component.css'
})
export class RemoteDesktopComponent {
  @Input() tab!: TabInstance;


  constructor() {

  }

}
