import {
  AfterViewInit,
  Component,
  ElementRef,
  Input,
  OnChanges,
  OnDestroy,
  SimpleChanges,
  ViewChild
} from '@angular/core';
import {Session} from '../../../../src/app/domain/session/Session';
import {VncService} from '../services/vnc.service';
import {TabService} from '../../../../src/app/services/tab.service';


@Component({
    selector: 'app-vnc',
    imports: [],
    templateUrl: './vnc.component.html',
    styleUrl: './vnc.component.scss'
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

  private readonly onWindowKeyDown = (event: KeyboardEvent) => {
    if (!this.canHandleClipboard(event.target)) return;
    if (!(event.ctrlKey || event.metaKey) || event.key?.toLowerCase() !== 'v') return;

    // Capture phase: stop noVNC from forwarding Ctrl+V before we have pushed the
    // local clipboard to the remote side, otherwise the remote app pastes stale text.
    event.preventDefault();
    event.stopPropagation();
    void this.vncService.pasteFromLocalClipboard(this.session.id, true);
  };

  private readonly onWindowPaste = (event: ClipboardEvent) => {
    if (!this.canHandleClipboard(event.target)) return;
    const text = event.clipboardData?.getData('text');
    if (!text) return;

    // Reached via context-menu paste: Control is not held remotely, so send the
    // full Ctrl+V shortcut after updating the remote clipboard.
    event.preventDefault();
    event.stopPropagation();
    this.vncService.pasteText(this.session.id, text);
  };

  private canHandleClipboard(target: EventTarget | null): boolean {
    if (!this.isViewInitialized || !this.vncService.isConnected(this.session.id)) return false;
    // Only the visible VNC tab reacts, and never steal paste from a dialog/input.
    if (this.tabService.getSelectedTab()?.id !== this.session.id) return false;
    if (document.querySelector('.cdk-overlay-pane')) return false;
    const el = target as HTMLElement | null;
    const tag = el?.tagName;
    return !(tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || !!el?.isContentEditable);
  }

  ngAfterViewInit(): void {
    this.connect();
    this.isViewInitialized = true;
    window.addEventListener('keydown', this.onWindowKeyDown, true);
    window.addEventListener('paste', this.onWindowPaste, true);
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
    window.removeEventListener('keydown', this.onWindowKeyDown, true);
    window.removeEventListener('paste', this.onWindowPaste, true);
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
