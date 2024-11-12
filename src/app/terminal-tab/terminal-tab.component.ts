import { Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import { Terminal } from 'xterm';

@Component({
  selector: 'app-terminal-tab',
  templateUrl: './terminal-tab.component.html',
  styleUrls: ['./terminal-tab.component.css']
})
export class TerminalTabComponent implements OnInit {
  @ViewChild('terminalContainer', { static: true }) terminalContainer!: ElementRef;
  private terminal: Terminal;

  constructor() {
    this.terminal = new Terminal();
  }

  ngOnInit() {
    this.terminal.open(this.terminalContainer.nativeElement);
    this.terminal.write('Welcome to the Angular Terminal\n');
  }
}
