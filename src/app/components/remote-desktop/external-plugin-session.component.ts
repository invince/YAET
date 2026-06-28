import {AfterViewInit, Component, ElementRef, Input, OnDestroy, OnInit, ViewChild} from '@angular/core';
import {Session} from '../../domain/session/Session';

declare const window: any;

@Component({
  selector: 'app-external-plugin-session',
  standalone: true,
  template: `
    <div #sessionContainer class="external-session-container"></div>
  `,
  styles: [`
    .external-session-container { width: 100%; height: 100%; }
  `],
})
export class ExternalPluginSessionComponent implements OnInit, AfterViewInit, OnDestroy {
  @Input() session!: Session;
  @Input() sessionElement = '';
  @ViewChild('sessionContainer', {static: true}) sessionContainer!: ElementRef;

  private _el: HTMLElement | null = null;

  ngOnInit(): void {
    if (!this.sessionElement) return;
    const el = document.createElement(this.sessionElement);
    this.sessionContainer.nativeElement.appendChild(el);
    this._el = el;
  }

  ngAfterViewInit(): void {
    if (this._el && typeof (this._el as any).setSession === 'function') {
      (this._el as any).setSession(this.session);
    }
  }

  ngOnDestroy(): void {
    if (this._el) {
      if (typeof (this._el as any).disconnect === 'function') {
        (this._el as any).disconnect();
      }
      if (this._el.parentNode) {
        this._el.parentNode.removeChild(this._el);
      }
    }
  }
}
