import {CommonModule} from '@angular/common';
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
import {MatButtonModule} from '@angular/material/button';
import {MatIconModule} from '@angular/material/icon';
import {FitAddon} from '@xterm/addon-fit';
import {WebLinksAddon} from '@xterm/addon-web-links';
import {Terminal} from '@xterm/xterm';
import {Profile, ProfileCategory, ProfileType} from '../../domain/profile/Profile';
import {ScpSession} from '../../domain/session/ScpSession';
import {Session} from '../../domain/session/Session';
import {TabInstance} from '../../domain/TabInstance';
import {ElectronTerminalService} from '../../services/electron/electron-terminal.service';
import {ScpService} from '../../services/file-explorer/scp.service';
import {TabService} from '../../services/tab.service';
import {TerminalInstanceService} from '../../services/terminal-instance.service';

@Component({
  selector: 'app-terminal',
  templateUrl: './terminal.component.html',
  styleUrls: ['./terminal.component.scss'],
  standalone: true,
  imports: [CommonModule, MatButtonModule, MatIconModule],
  encapsulation: ViewEncapsulation.None
})
export class TerminalComponent implements AfterViewInit, OnChanges, OnDestroy {
  @Input() session!: Session;
  @ViewChild('term', { static: false }) terminalDiv!: ElementRef;
  @ViewChild('termContainer', { static: false }) termContainer!: ElementRef;
  private isViewInitialized = false;

  private xtermUnderlying: Terminal;
  // private webglAddon = new WebglAddon();
  private fitAddon = new FitAddon();
  private resizeObserver: ResizeObserver | undefined;

  constructor(
    private electron: ElectronTerminalService,
    private tabService: TabService,
    private scpService: ScpService,
    private terminalInstanceService: TerminalInstanceService,
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
    this.terminalInstanceService.register(this.session.id, this.xtermUnderlying);

    this.xtermUnderlying.loadAddon(new WebLinksAddon((event: MouseEvent, uri: string) => {
      if (event.button === 0 && event.ctrlKey) { // ctrl + click = open link in web browser
        this.electron.openUrl(uri);
      }
      if (event.button === 0) { // ctrl + right click = copy the url
        navigator.clipboard.writeText(uri);
      }
    }));
    this.xtermUnderlying.loadAddon(this.fitAddon);
    // this.webglAddon.onContextLoss(e => {
    //   this.webglAddon.dispose();
    // });
    // this.xtermUnderlying.loadAddon(this.webglAddon);
    // this.terminal.setXtermOptions({
    //   fontFamily: '"Cascadia Code", Menlo, monospace',
    //   // theme: {
    //   //   background: 'rgba(0, 0, 0, 0)' // Fully transparent background
    //   // },
    //   convertEol: false,
    //   cursorBlink: true
    // });

    this.xtermUnderlying.onResize(size => {
      this.electron.sendTerminalResize(this.session.id, size.cols, size.rows);
    });

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
    // Only close the session if the tab is actually removed from the service
    // If the tab still exists (e.g. moving between panes), don't close the session
    const isTabStillActive = this.tabService.tabs.some(t => t.id === this.session.id);
    if (!isTabStillActive) {
      this.session.close();
      this.terminalInstanceService.unregister(this.session.id);
    }

    this.fitAddon?.dispose();
    this.resizeObserver?.disconnect();
  }

  get isSsh(): boolean {
    return this.session?.profileType === ProfileType.SSH_TERMINAL;
  }

  openScpExplorer(event?: MouseEvent) {
    if (event) {
      event.stopPropagation();
    }
    if (!this.session?.profile) return;

    // Clone the profile
    const scpProfile = Profile.clone(this.session.profile);
    scpProfile.category = ProfileCategory.FILE_EXPLORER;
    scpProfile.profileType = ProfileType.SCP_FILE_EXPLORER;

    if (this.tabService.splitMode) {
      const currentTab = this.tabService.tabs.find(t => t.id === this.session?.id);
      if (currentTab) {
        this.tabService.activePane = currentTab.paneId === 0 ? 1 : 0;
      } else {
        this.tabService.activePane = this.tabService.activePane === 0 ? 1 : 0;
      }
    }

    // Create new session
    const session = new ScpSession(scpProfile, ProfileType.SCP_FILE_EXPLORER, this.tabService, this.scpService);

    // Create and add new tab instance
    const tabInstance = new TabInstance(ProfileCategory.FILE_EXPLORER, session);
    this.tabService.addTab(tabInstance);
  }
}
