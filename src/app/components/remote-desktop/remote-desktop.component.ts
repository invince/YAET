import {Component, Input, OnInit} from '@angular/core';
import {NgComponentOutlet} from '@angular/common';
import {Session} from '../../domain/session/Session';
import {PluginRegistryService} from '../../plugin/services/plugin-registry.service';

@Component({
    selector: 'app-remote-desktop',
    imports: [
        NgComponentOutlet
    ],
    templateUrl: './remote-desktop.component.html',
    styleUrl: './remote-desktop.component.scss'
})
export class RemoteDesktopComponent implements OnInit {
  @Input() session!: Session;
  componentType: any;
  componentInputs: any;

  constructor(private registry: PluginRegistryService) {}

  ngOnInit() {
    this.componentType = this.registry.getSessionComponent(this.session.profileType);
    this.componentInputs = { session: this.session };
  }
}
