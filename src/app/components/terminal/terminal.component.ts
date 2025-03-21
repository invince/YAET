import {
  AfterViewInit,
  Component,
  ElementRef,
  Input,
  OnChanges,
  OnDestroy,
  SimpleChanges,
  ViewChild,
  ViewEncapsulation
} from '@angular/core';
import {Terminal} from '@xterm/xterm';
import {Session} from '../../domain/session/Session';
import {FitAddon} from '@xterm/addon-fit';
import {WebLinksAddon} from '@xterm/addon-web-links';
import {WebglAddon} from '@xterm/addon-webgl';
import {ElectronTerminalService} from '../../services/electron/electron-terminal.service';

@Component({
  selector: 'app-terminal',
  templateUrl: './terminal.component.html',
  styleUrls: ['./terminal.component.scss'],
  standalone: true,
  encapsulation: ViewEncapsulation.None
})
export class TerminalComponent implements AfterViewInit, OnChanges, OnDestroy {
  @Input() session!: Session;
  // @ViewChild('term', {static: false}) xtermUnderlying!: Terminal;
  @ViewChild('term', {static: false}) terminalDiv!: ElementRef;
  @ViewChild('termContainer', {static: false}) termContainer!: ElementRef;
  private isViewInitialized = false;

  private xtermUnderlying: Terminal;
  private webglAddon = new WebglAddon();
  private fitAddon = new FitAddon();
  private resizeObserver: ResizeObserver | undefined;

  constructor(
    private electron: ElectronTerminalService,
  ) {
    this.xtermUnderlying = new Terminal({
      fontFamily: '"Cascadia Code", Menlo, monospace',
      // theme: {
      //   background: 'rgba(0, 0, 0, 0)' // Fully transparent background
      // },
      convertEol: false,
      cursorBlink: true
    });


  }

  ngAfterViewInit(): void {
    this.xtermUnderlying.open(this.terminalDiv.nativeElement);

    this.xtermUnderlying.loadAddon(new WebLinksAddon());
    this.xtermUnderlying.loadAddon(this.fitAddon);
    this.webglAddon.onContextLoss(e => {
      this.webglAddon.dispose();
    });
    this.xtermUnderlying.loadAddon(this.webglAddon);
    // this.terminal.setXtermOptions({
    //   fontFamily: '"Cascadia Code", Menlo, monospace',
    //   // theme: {
    //   //   background: 'rgba(0, 0, 0, 0)' // Fully transparent background
    //   // },
    //   convertEol: false,
    //   cursorBlink: true
    // });

    // this.xtermUnderlying.onResize(size => {
    //   this.electron.sendTerminalResize(this.session.id, size.cols, size.rows);
    // });

    // Force initial fit
    setTimeout(() => this.fitAddon.fit(), 0);

// Add ResizeObserver for container changes
    this.resizeObserver = new ResizeObserver(() => this.fitAddon.fit());
    this.resizeObserver.observe(this.termContainer.nativeElement);

    //  ctrl + shift + c for copy when selecting data, default otherwise
    this.xtermUnderlying.attachCustomKeyEventHandler((arg) => {
      if (arg.ctrlKey && arg.shiftKey && arg.code === "KeyC" && arg.type === "keydown") {
        const selection = this.xtermUnderlying?.getSelection();
        if (selection) {
          navigator.clipboard.writeText(selection);
          return false;
        }
      }
      return true;
    });

    // right click for paste. NOTE: ctrl + v should work natively
    this.termContainer.nativeElement.addEventListener('contextmenu', (event: MouseEvent) => {
      event.preventDefault(); // Prevent the default context menu
      const selection = this.xtermUnderlying?.getSelection();
      if (selection) {
        navigator.clipboard.writeText(selection);
      } else {
        navigator.clipboard.readText()
          .then(text => {
            this.electron.sendTerminalInput(this.session.id, text);
          })
      }
    });


    this.initTab();

    this.isViewInitialized = true;
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['session'] && this.isViewInitialized) {
      this.initTab();
    }
  }

  initTab() {
    if (!this.session) {
      throw new Error("Invalid tab");
    }

    this.xtermUnderlying?.clear();

    // Set up data listeners and communication with the Electron main process
    this.session.open();

    // Listen to output from Electron and display in xterm
    this.electron.onTerminalOutput(this.session.id, (data) => {
      this.xtermUnderlying?.write(data.data);
    });

    // Send user input back to Electron main process
    // if (this.terminalOnDataSubscription) {
    //   this.terminalOnDataSubscription.unsubscribe();
    // }
    this.xtermUnderlying.onData(data => this.electron.sendTerminalInput(this.session.id, data));
  }

  ngOnDestroy() {
    this.session.close();
    this.fitAddon?.dispose();
    this.resizeObserver?.disconnect();
  }
}
