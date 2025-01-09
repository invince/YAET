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
import {Session} from '../../../domain/session/Session';


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
  ) {}


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
    this.session.close();
  }

  showRealSize() {

  }

  resizeToFit() {
  }
}
