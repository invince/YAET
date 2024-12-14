import {AfterViewInit, Component, ElementRef, Input, OnChanges, OnInit, SimpleChanges, ViewChild} from '@angular/core';
import {VncService} from '../../../services/vnc.service';
import {VncProfile} from '../../../domain/profile/VncProfile';
import {TabInstance} from '../../../domain/TabInstance';
import {Profile} from '../../../domain/profile/Profile';
import {NgxSpinnerService} from 'ngx-spinner';

@Component({
  selector: 'app-vnc',
  standalone: true,
  imports: [],
  templateUrl: './vnc.component.html',
  styleUrl: './vnc.component.css'
})
export class VncComponent implements AfterViewInit, OnChanges {

  @Input() tab!: TabInstance;
  private isViewInitialized = false;

  @ViewChild('canvas', { static: true }) canvas!: ElementRef<HTMLCanvasElement>;
  private ctx!: CanvasRenderingContext2D | null;

  status: string = 'disconnected';

  constructor(
    private vncService: VncService,
    private spinner: NgxSpinnerService,
  ) {}

  ngOnInit(): void {
    this.ctx = this.canvas.nativeElement.getContext('2d');

    this.vncService.status$.subscribe((obj) => {
      if (obj && obj.id == this.tab.id) {
        this.status = obj.status;
        if (this.status == 'connected' ){
          this.tab.connected = true;
          this.spinner.hide()
        } else if (this.status == 'disconnected' ){
          this.tab.connected = false;
        }
      }
    });

    this.vncService.frame$.subscribe((obj) => {
      if (obj && obj.id == this.tab.id) {
        let frame = obj.frame;
        if (frame && this.ctx) {
            const imageData = new ImageData(
              new Uint8ClampedArray(frame.data),
              frame.width,
              frame.height
            );
            this.ctx.putImageData(imageData, frame.x, frame.y);
        }
      }
    });
  }
  ngAfterViewInit(): void {
    this.connect();
    this.isViewInitialized = true;
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['vnc'] && this.isViewInitialized) {
      this.connect();
    }
  }
  connect() {
    this.spinner.show();
    this.vncService.connect(this.tab?.id, this.tab?.profile?.vncProfile);
  }

  disconnect() {
    this.vncService.disconnect(this.tab?.id);
  }
}
