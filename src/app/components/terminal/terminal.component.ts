import {Component, Input, ViewChild, AfterViewInit, ViewEncapsulation, OnChanges, SimpleChanges} from '@angular/core';
import {ElectronService} from '../../services/electron.service';
import {NgTerminal, NgTerminalModule} from 'ng-terminal';
import {Terminal} from '@xterm/xterm';
import {TabInstance} from '../../domain/TabInstance';
import {TabService} from '../../services/tab.service';

@Component({
  selector: 'app-terminal',
  templateUrl: './terminal.component.html',
  styleUrls: ['./terminal.component.scss'],
  imports: [NgTerminalModule],
  standalone: true,
  encapsulation: ViewEncapsulation.None
})
export class TerminalComponent implements AfterViewInit, OnChanges {
  @Input() tab!: TabInstance;
  @ViewChild('term', {static: false}) terminal!: NgTerminal;
  private isViewInitialized = false;

  private xtermUnderlying : Terminal | undefined;

  constructor(
    private electronService: ElectronService,
  ) {
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

    this.initTab();
    // Listen to output from Electron and display in xterm
    this.electronService.onTerminalOutput(this.tab.id, (data) => {
      this.terminal.write(data.data);
    });

    // Send user input back to Electron main process
    this.terminal.onData().subscribe(data => {
      this.electronService.sendTerminalInput(this.tab.id, data);
    });
    this.isViewInitialized = true;
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['tab'] && this.isViewInitialized) {
      this.initTab();
    }
  }

  initTab() {
    if (!this.tab) {
      throw new Error("Invalid tab");
    }

    this.xtermUnderlying?.clear();

    // Set up data listeners and communication with the Electron main process
    this.electronService.openTerminalSession(this.tab);

  }
}
