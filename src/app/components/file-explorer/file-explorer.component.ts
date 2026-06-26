import {Component, Input, OnInit} from '@angular/core';
import {NgComponentOutlet} from '@angular/common';
import {Session} from '../../domain/session/Session';
import {PluginRegistryService} from '../../plugin/services/plugin-registry.service';

@Component({
    selector: 'app-file-explorer',
    imports: [
        NgComponentOutlet,
    ],
    templateUrl: './file-explorer.component.html',
    styleUrl: './file-explorer.component.scss'
})
export class FileExplorerComponent implements OnInit {
  @Input() session!: Session;
  componentType: any;
  componentInputs: any;

  constructor(private registry: PluginRegistryService) {}

  ngOnInit() {
    this.componentType = this.registry.getSessionComponent(this.session.profileType);
    this.componentInputs = { session: this.session };
  }
}
