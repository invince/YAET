import {Component, Input, ViewChild} from '@angular/core';
import {TabInstance} from '../../domain/TabInstance';
import {NgTerminal} from 'ng-terminal';

@Component({
  selector: 'app-remote-desktop',
  standalone: true,
  imports: [],
  templateUrl: './remote-desktop.component.html',
  styleUrl: './remote-desktop.component.css'
})
export class RemoteDesktopComponent {
  @Input() tab!: TabInstance;
  @ViewChild('term', {static: false}) terminal!: NgTerminal;
}
