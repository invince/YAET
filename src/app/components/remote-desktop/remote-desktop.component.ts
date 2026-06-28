import {Component, Input, OnInit} from '@angular/core';
import {NgComponentOutlet} from '@angular/common';
import {Session} from '../../domain/session/Session';
import {PluginRegistryService} from '../../plugin/services/plugin-registry.service';
import {ExternalPluginSessionComponent} from './external-plugin-session.component';

@Component({
    selector: 'app-remote-desktop',
    imports: [
        NgComponentOutlet,
        ExternalPluginSessionComponent,
    ],
    templateUrl: './remote-desktop.component.html',
    styleUrl: './remote-desktop.component.scss'
})
export class RemoteDesktopComponent implements OnInit {
  @Input() session!: Session;
  componentType: any;
  componentInputs: any;
  externalSessionElement = '';
  useExternalPlugin = false;

  constructor(private registry: PluginRegistryService) {}

  ngOnInit() {
    this.componentType = this.registry.getSessionComponent(this.session.profileType);
    this.componentInputs = { session: this.session };

    if (!this.componentType) {
      const ext = this.registry.getExternalPlugin(this.session.profileType);
      if (ext?.sessionElement) {
        this.useExternalPlugin = true;
        this.externalSessionElement = ext.sessionElement;
      }
    }
  }
}
