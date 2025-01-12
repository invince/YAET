import {
  Component,
  Input,
  ViewChild,
  AfterViewInit,
  ViewEncapsulation,
  OnChanges,
  SimpleChanges,
  OnDestroy, ElementRef
} from '@angular/core';
import {ElectronService} from '../../services/electron.service';
import {NgTerminal, NgTerminalModule} from 'ng-terminal';
import {Terminal} from '@xterm/xterm';
import {Session} from '../../domain/session/Session';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { WebglAddon } from '@xterm/addon-webgl';
import {Subscription} from 'rxjs';

@Component({
  selector: 'app-terminal',
  templateUrl: './terminal.component.html',
  styleUrls: ['./terminal.component.scss'],
  imports: [NgTerminalModule],
  standalone: true,
  encapsulation: ViewEncapsulation.None
})
export class TerminalComponent implements AfterViewInit, OnChanges, OnDestroy {
  @Input() session!: Session;
  @ViewChild('term', {static: false}) terminal!: NgTerminal;
  @ViewChild('termContainer', {static: false}) termContainer!: ElementRef;
  private isViewInitialized = false;

  private xtermUnderlying : Terminal | undefined;
  private webglAddon = new WebglAddon();

  private terminalOnDataSubscription?: Subscription;

  constructor(
    private electron: ElectronService,
  ) {
  }

  ngAfterViewInit(): void {

    // Open terminal in the container
    this.xtermUnderlying = this.terminal.underlying;
    if (this.xtermUnderlying) {
      this.xtermUnderlying.loadAddon(new WebLinksAddon());
      this.xtermUnderlying.loadAddon(new FitAddon());
      this.webglAddon.onContextLoss(e => {
        this.webglAddon.dispose();
      });
      this.xtermUnderlying.loadAddon(this.webglAddon);
      this.terminal.setXtermOptions({
        fontFamily: '"Cascadia Code", Menlo, monospace',
        // theme: {
        //   background: 'rgba(0, 0, 0, 0)' // Fully transparent background
        // },
        cursorBlink: true
      });

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

    }

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
      this.terminal.write(data.data);
    });

    // Send user input back to Electron main process
    if (this.terminalOnDataSubscription) {
      this.terminalOnDataSubscription.unsubscribe();
    }
    this.terminalOnDataSubscription = this.terminal.onData().subscribe(data => {
      this.electron.sendTerminalInput(this.session.id, data);
    });
  }

  ngOnDestroy() {
    this.session.close();
    if (this.terminalOnDataSubscription) {
      this.terminalOnDataSubscription.unsubscribe();
    }
  }
}
