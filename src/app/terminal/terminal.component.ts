import {Component, Input, ViewChild, ElementRef, AfterViewInit, OnDestroy, ViewEncapsulation} from '@angular/core';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { ElectronService } from '../electron.service';

@Component({
  selector: 'app-terminal',
  templateUrl: './terminal.component.html',
  styleUrls: ['./terminal.component.css'],
  standalone: true,
})
export class TerminalComponent implements AfterViewInit, OnDestroy {
  @ViewChild('terminalContainer', { static: true }) terminalContainer!: ElementRef;
  @Input() terminalId!: number;

  private terminal: Terminal;


  constructor(private electronService: ElectronService) {
    this.terminal = new Terminal({
      theme: {
        background: 'rgba(0, 0, 0, 0)' // Fully transparent background
      }
    });

  }

  ngAfterViewInit(): void {
    // Open terminal in the container
    const fitAddon = new FitAddon();
    this.terminal.loadAddon(fitAddon);
    this.terminal.open(this.terminalContainer.nativeElement);
    this.terminal.focus();
    fitAddon.fit();


    // Set up data listeners and communication with the Electron main process
    this.electronService.createTerminal(this.terminalId);

    // Listen to output from Electron and display in xterm
    this.electronService.onTerminalOutput((data) => {
      this.terminal.write(data);
    });

    // Send user input back to Electron main process
    this.terminal.onData(data => {
      this.electronService.sendTerminalInput(this.terminalId, data);
    });
  }

  ngOnDestroy(): void {
    this.terminal.dispose();
  }
}
