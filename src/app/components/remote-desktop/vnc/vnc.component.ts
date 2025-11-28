import {
  AfterViewInit,
  Component,
  ElementRef,
  HostListener,
  Input,
  OnChanges,
  OnDestroy,
  SimpleChanges,
  ViewChild
} from '@angular/core';
import { Session } from '../../../domain/session/Session';
import { VncService } from '../../../services/remote-desktop/vnc.service';
import { TabService } from '../../../services/tab.service';


@Component({
    selector: 'app-vnc',
    imports: [],
    templateUrl: './vnc.component.html',
    styleUrl: './vnc.component.css'
})
export class VncComponent implements AfterViewInit, OnChanges, OnDestroy {

  @Input() session!: Session;
  private isViewInitialized = false;

  status: string = 'disconnected';

  constructor(
    private tabService: TabService,
    private vncService: VncService
  ) { }


  @ViewChild('vnc', { static: true }) vncContainer!: ElementRef;

  private processingPaste = false;

  @HostListener('window:paste', ['$event'])
  handlePaste(event: ClipboardEvent) {
    console.log('VNC Component: Paste event received');
    if (this.processingPaste) {
      console.log('VNC Component: Ignoring paste event (already processing)');
      event.preventDefault();
      event.stopPropagation();
      return;
    }

    if (this.isViewInitialized) {
      // Prevent default paste behavior to avoid double paste
      event.preventDefault();
      event.stopPropagation();

      const text = event.clipboardData?.getData('text');
      if (text) {
        this.vncService.handleClipboardPaste(this.session.id, text);
      }
    }
  }

  // Use arrow function to bind 'this' correctly for addEventListener
  private handleKeyDownCapture = async (event: KeyboardEvent) => {
    if ((event.ctrlKey || event.metaKey) && (event.code === 'KeyV' || event.key === 'v' || event.key === 'V')) {
      console.log('VNC Component: Intercepted Ctrl+V (KeyDown)', event);
      if (this.isViewInitialized) {
        // We do NOT prevent default here, letting noVNC handle the key
        // event.preventDefault();
        // event.stopPropagation();
        // event.stopImmediatePropagation();

        try {
          const text = await navigator.clipboard.readText();
          console.log('VNC Component: Read clipboard text', text);
          if (text) {
            this.vncService.handleClipboardPaste(this.session.id, text);
          }
        } catch (err) {
          console.error('Failed to read clipboard contents: ', err);
        }
      }
    }
  }

  ngOnInit(): void {
    window.addEventListener('keydown', this.handleKeyDownCapture, true); // Capture phase
  }
  ngAfterViewInit(): void {
    this.connect();
    // this.resizeToFit();
    this.isViewInitialized = true;
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['session'] && this.isViewInitialized) {
      this.connect();
    }
  }
  connect() {
    this.session.open(this.vncContainer);
  }

  ngOnDestroy() {
    window.removeEventListener('keydown', this.handleKeyDownCapture, true);
    this.disconnect();
  }

  disconnect() {
    const isTabStillActive = this.tabService.tabs.some(t => t.id === this.session.id);
    if (!isTabStillActive) {
      this.session.close();
    }
  }

  showRealSize() {

  }

  resizeToFit() {
  }
}
