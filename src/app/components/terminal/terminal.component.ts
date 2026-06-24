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
import {Profile, ProfileCategory} from '../../domain/profile/Profile';
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
  encapsulation: ViewEncapsulation.ShadowDom
})
export class TerminalComponent implements AfterViewInit, OnChanges, OnDestroy {
  @Input() session!: Session;
  @ViewChild('term', { static: false }) terminalDiv!: ElementRef;
  @ViewChild('termContainer', { static: false }) termContainer!: ElementRef;

  // xterm's scrollbar is too hard to manipulate we create our own custom to override it
  @ViewChild('scrollbar', { static: false }) scrollbarRef!: ElementRef;
  @ViewChild('scrollbarThumb', { static: false }) scrollbarThumbRef!: ElementRef;

  private isViewInitialized = false;

  private xtermUnderlying: Terminal;
  // private webglAddon = new WebglAddon();
  private fitAddon = new FitAddon();
  private resizeObserver: ResizeObserver | undefined;
  private contextMenuHandler: ((event: MouseEvent) => void) | null = null;
  private terminalOutputCleanup: (() => void) | null = null;

  private scrollDisposable: { dispose: () => void } | null = null;
  private scrollResizeDisposable: { dispose: () => void } | null = null;
  private isDraggingScrollbar = false;
  private dragStartY = 0;
  private dragStartThumbTop = 0;
  private onScrollbarDragMove: ((event: MouseEvent) => void) | null = null;
  private onScrollbarDragEnd: ((event: MouseEvent) => void) | null = null;
  private onViewportScroll: (() => void) | null = null;

  constructor(
    private electron: ElectronTerminalService,
    private tabService: TabService,
    private scpService: ScpService,
    private terminalInstanceService: TerminalInstanceService,
  ) {
    const isWin = (window as any).electronAPI?.platform === 'win32';
    this.xtermUnderlying = new Terminal({
      fontFamily: '"Cascadia Code", Menlo, monospace',
      // theme: {
      //   background: 'rgba(0, 0, 0, 0)' // Fully transparent background
      // },
      convertEol: false,
      cursorBlink: true,
      windowsMode: false,
      ...(isWin ? { windowsPty: { backend: 'conpty' } } : {})
    });


  }

  ngAfterViewInit(): void {
    this.xtermUnderlying.open(this.terminalDiv.nativeElement);
    this.injectScrollbarStyles();
    this.initScrollbar();

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

    this.scrollResizeDisposable = this.xtermUnderlying.onResize(() => {
      this.updateScrollbarThumb();
    });

    this.xtermUnderlying.onResize(size => {
      this.electron.sendTerminalResize(this.session.id, size.cols, size.rows);
    });

    const doFit = () => {
      try { this.fitAddon.fit(); } catch (_) { }
    };

    requestAnimationFrame(() => doFit());

    const interval = setInterval(doFit, 300);
    setTimeout(() => clearInterval(interval), 3000);

    this.resizeObserver = new ResizeObserver(() => {
      doFit();
      this.updateScrollbarThumb();
      clearInterval(interval);
    });
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
    this.contextMenuHandler = (event: MouseEvent) => {
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
    };
    this.termContainer.nativeElement.addEventListener('contextmenu', this.contextMenuHandler);


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
    this.terminalOutputCleanup?.();
    this.terminalOutputCleanup = this.electron.onTerminalOutput(this.session.id, (data) => {
      this.xtermUnderlying?.write(data.data);
    });

    // Send user input back to Electron main process
    // if (this.terminalOnDataSubscription) {
    //   this.terminalOnDataSubscription.unsubscribe();
    // }
    this.xtermUnderlying.onData(data => this.electron.sendTerminalInput(this.session.id, data));
  }

  ngOnDestroy() {
    // Cleanup contextmenu listener
    if (this.contextMenuHandler && this.termContainer?.nativeElement) {
      this.termContainer.nativeElement.removeEventListener('contextmenu', this.contextMenuHandler);
      this.contextMenuHandler = null;
    }

    // Cleanup terminal output listener
    this.terminalOutputCleanup?.();
    this.terminalOutputCleanup = null;

    // Only close the session if the tab is actually removed from the service
    // If the tab still exists (e.g. moving between panes), don't close the session
    const isTabStillActive = this.tabService.tabs.some(t => t.id === this.session.id);
    if (!isTabStillActive) {
      this.session.close();
      this.terminalInstanceService.unregister(this.session.id);
    }

    this.scrollDisposable?.dispose();
    this.scrollDisposable = null;
    this.scrollResizeDisposable?.dispose();
    this.scrollResizeDisposable = null;

    if (this.onScrollbarDragMove) {
      document.removeEventListener('mousemove', this.onScrollbarDragMove);
      this.onScrollbarDragMove = null;
    }
    if (this.onScrollbarDragEnd) {
      document.removeEventListener('mouseup', this.onScrollbarDragEnd);
      this.onScrollbarDragEnd = null;
    }

    if (this.onViewportScroll) {
      const viewport = this.terminalDiv?.nativeElement.querySelector('.xterm-viewport');
      if (viewport) {
        viewport.removeEventListener('scroll', this.onViewportScroll);
      }
      this.onViewportScroll = null;
    }

    this.fitAddon?.dispose();
    this.resizeObserver?.disconnect();
  }

  get isSsh(): boolean {
    return this.session?.profileType === 'SSH_TERMINAL';
  }

  openScpExplorer(event?: MouseEvent) {
    if (event) {
      event.stopPropagation();
    }
    if (!this.session?.profile) return;

    // Clone the profile
    const scpProfile = Profile.clone(this.session.profile);
    scpProfile.category = ProfileCategory.FILE_EXPLORER;
    scpProfile.profileType = 'SCP_FILE_EXPLORER';

    if (this.tabService.splitMode) {
      const currentTab = this.tabService.tabs.find(t => t.id === this.session?.id);
      if (currentTab) {
        this.tabService.activePane = currentTab.paneId === 0 ? 1 : 0;
      } else {
        this.tabService.activePane = this.tabService.activePane === 0 ? 1 : 0;
      }
    }

    // Create new session
    const session = new ScpSession(scpProfile, 'SCP_FILE_EXPLORER', this.tabService, this.scpService);

    // Create and add new tab instance
    const tabInstance = new TabInstance(ProfileCategory.FILE_EXPLORER, session);
    this.tabService.addTab(tabInstance);
  }


  private injectScrollbarStyles() {
    try {
      const viewport = this.terminalDiv.nativeElement.querySelector('.xterm-viewport');
      if (!viewport) return;
      viewport.style.setProperty('scrollbar-width', 'none');

      const style = document.createElement('style');
      style.textContent = `
        .xterm-viewport::-webkit-scrollbar {
          display: none !important;
          width: 0 !important;
          height: 0 !important;
        }
      `;
      viewport.appendChild(style);
    } catch (e) {
      console.error('Failed to inject scrollbar styles:', e);
    }
  }

  private initScrollbar() {
    this.updateScrollbarThumb();

    this.scrollDisposable = this.xtermUnderlying.onScroll(() => {
      this.updateScrollbarThumb();
    });

    const viewport = this.terminalDiv.nativeElement.querySelector('.xterm-viewport');
    if (viewport) {
      this.onViewportScroll = () => {
        requestAnimationFrame(() => this.updateScrollbarThumb());
      };
      viewport.addEventListener('scroll', this.onViewportScroll);
    }

    this.onScrollbarDragMove = (event: MouseEvent) => {
      if (!this.isDraggingScrollbar) return;
      const track = this.scrollbarRef?.nativeElement;
      const thumb = this.scrollbarThumbRef?.nativeElement;
      if (!track || !thumb) return;

      const trackHeight = track.clientHeight;
      const thumbHeight = thumb.clientHeight;
      const maxThumbTop = trackHeight - thumbHeight;
      if (maxThumbTop <= 0) return;

      const deltaY = event.clientY - this.dragStartY;
      const newThumbTop = Math.max(0, Math.min(maxThumbTop, this.dragStartThumbTop + deltaY));
      const scrollRatio = newThumbTop / maxThumbTop;
      const baseY = this.xtermUnderlying.buffer.active.baseY;
      if (baseY <= 0) return;

      this.xtermUnderlying.scrollToLine(Math.round(scrollRatio * baseY));
    };

    this.onScrollbarDragEnd = () => {
      if (!this.isDraggingScrollbar) return;
      this.isDraggingScrollbar = false;
      const thumb = this.scrollbarThumbRef?.nativeElement;
      if (thumb) thumb.classList.remove('dragging');
    };

    document.addEventListener('mousemove', this.onScrollbarDragMove);
    document.addEventListener('mouseup', this.onScrollbarDragEnd);
  }

  private updateScrollbarThumb() {
    const thumb = this.scrollbarThumbRef?.nativeElement;
    const track = this.scrollbarRef?.nativeElement;
    if (!thumb || !track) return;

    const baseY = this.xtermUnderlying.buffer.active.baseY;
    const rows = this.xtermUnderlying.rows;
    const trackHeight = track.clientHeight;

    if (baseY <= 0 || trackHeight <= 0) {
      thumb.style.height = Math.min(24, trackHeight) + 'px';
      thumb.style.top = '0';
      return;
    }

    const thumbRatio = rows / (baseY + rows);
    const thumbHeight = Math.max(24, Math.min(trackHeight, trackHeight * thumbRatio));
    const maxThumbTop = trackHeight - thumbHeight;

    thumb.style.height = thumbHeight + 'px';

    const viewportY = this.xtermUnderlying.buffer.active.viewportY;
    const scrollRatio = viewportY / baseY;
    thumb.style.top = (scrollRatio * maxThumbTop) + 'px';
  }

  onScrollbarThumbMouseDown(event: MouseEvent) {
    event.preventDefault();
    event.stopPropagation();

    this.isDraggingScrollbar = true;
    this.dragStartY = event.clientY;
    this.dragStartThumbTop = parseInt(this.scrollbarThumbRef.nativeElement.style.top || '0', 10);
    this.scrollbarThumbRef.nativeElement.classList.add('dragging');
  }

  onScrollbarTrackMouseDown(event: MouseEvent) {
    if ((event.target as HTMLElement).classList.contains('terminal-scrollbar-thumb')) return;

    const track = this.scrollbarRef.nativeElement;
    const thumb = this.scrollbarThumbRef.nativeElement;
    const trackRect = track.getBoundingClientRect();
    const clickY = event.clientY - trackRect.top;
    const thumbTop = parseInt(thumb.style.top || '0', 10);
    const rows = this.xtermUnderlying.rows;

    if (clickY < thumbTop) {
      this.xtermUnderlying.scrollLines(-Math.max(1, rows - 1));
    } else {
      this.xtermUnderlying.scrollLines(Math.max(1, rows - 1));
    }
  }
}
