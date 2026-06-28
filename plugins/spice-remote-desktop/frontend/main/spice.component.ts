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
import {SpiceService} from '../services/spice.service';
import {TabService} from '../../../../src/app/services/tab.service';

@Component({
    selector: 'app-spice',
    imports: [],
    templateUrl: './spice.component.html',
    styleUrl: './spice.component.scss'
})
export class SpiceComponent implements AfterViewInit, OnChanges, OnDestroy {

  @Input() session!: Session;
  private isViewInitialized = false;

  constructor(
    private tabService: TabService,
    private spiceService: SpiceService
  ) { }

  @ViewChild('spice', { static: true }) spiceContainer!: ElementRef;

  ngAfterViewInit(): void {
    this.connect();
    this.isViewInitialized = true;
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['session'] && this.isViewInitialized) {
      this.connect();
    }
  }

  connect() {
    this.session.open(this.spiceContainer);
  }

  ngOnDestroy() {
    this.disconnect();
  }

  disconnect() {
    const isTabStillActive = this.tabService.tabs.some(t => t.id === this.session.id);
    if (!isTabStillActive) {
      this.session.close();
    }
  }
}
