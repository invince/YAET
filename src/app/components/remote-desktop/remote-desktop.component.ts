import {Component, Input} from '@angular/core';
import {VncComponent} from "../../../../plugins/vnc-remote-desktop/frontend/vnc.component";
import {Session} from '../../domain/session/Session';

@Component({
    selector: 'app-remote-desktop',
    imports: [
        VncComponent
    ],
    templateUrl: './remote-desktop.component.html',
    styleUrl: './remote-desktop.component.scss'
})
export class RemoteDesktopComponent {
  @Input() session!: Session;


  constructor() {

  }

}
