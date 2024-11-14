import {Component, Input, ViewChild, AfterViewInit, ViewEncapsulation} from '@angular/core';
import {ElectronService} from '../electron.service';
import {NgTerminal, NgTerminalModule} from 'ng-terminal';
import {WebLinksAddon} from '@xterm/addon-web-links';
import {Terminal} from '@xterm/xterm';

@Component({
  selector: 'app-terminal',
  templateUrl: './terminal.component.html',
  styleUrls: ['./terminal.component.scss'],
  imports: [NgTerminalModule],
  standalone: true,
  encapsulation: ViewEncapsulation.None
})
export class TerminalComponent implements AfterViewInit {
  @Input() terminalId!: number;
  @ViewChild('term', {static: false}) terminal!: NgTerminal;

  private xtermUnderlying : Terminal | undefined;

  constructor(private electronService: ElectronService) {
  }

  ngAfterViewInit(): void {
    // Open terminal in the container
    this.xtermUnderlying = this.terminal.underlying;
    if (this.xtermUnderlying) {
      // this.xtermUnderlying.loadAddon(new WebLinksAddon());
      this.terminal.setXtermOptions({
        fontFamily: '"Cascadia Code", Menlo, monospace',
        // theme: {
        //   background: 'rgba(0, 0, 0, 0)' // Fully transparent background
        // },
        cursorBlink: true
      });
    }


    // Set up data listeners and communication with the Electron main process
    this.electronService.createTerminal(this.terminalId);

    // Listen to output from Electron and display in xterm
    this.electronService.onTerminalOutput((data) => {
      this.terminal.write(data);
    });

    // Send user input back to Electron main process
    this.terminal.onData().subscribe(data => {
      this.electronService.sendTerminalInput(this.terminalId, data);
    });
  }
}
