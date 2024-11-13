import {AfterViewInit, Component, Input} from '@angular/core';
import { ElectronService } from '../electron.service';
@Component({
  selector: 'app-terminal-component',
  templateUrl: './terminal-component.component.html',
  styleUrl: './terminal-component.component.css',
  standalone: true,
  imports: []
})
export class TerminalComponent implements AfterViewInit {

  @Input() terminalId!: number;

  constructor(private electronService: ElectronService) {}

  ngAfterViewInit() {
    this.electronService.createTerminal(this.terminalId);
  }
}
