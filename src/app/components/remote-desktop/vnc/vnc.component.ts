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
import { Session } from '../../../domain/session/Session';
import { TabService } from '../../../services/tab.service';


@Component({
  selector: 'app-vnc',
  standalone: true,
  imports: [],
  templateUrl: './vnc.component.html',
  styleUrl: './vnc.component.css'
})
export class VncComponent implements AfterViewInit, OnChanges, OnDestroy {

  @Input() session!: Session;
  private isViewInitialized = false;

  status: string = 'disconnected';

  constructor(
    private tabService: TabService
  ) { }


  @ViewChild('vnc', { static: true }) vncContainer!: ElementRef;

  ngOnInit(): void {

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
