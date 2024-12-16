import {AfterViewInit, Component, ElementRef, Input, OnChanges, OnInit, SimpleChanges, ViewChild} from '@angular/core';
import {VncService} from '../../../services/vnc.service';
import {TabInstance} from '../../../domain/TabInstance';
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

  status: string = 'disconnected';

  constructor(
    public vncService: VncService,
    private spinner: NgxSpinnerService,
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
    if (changes['vnc'] && this.isViewInitialized) {
      this.connect();
    }
  }
  connect() {
    this.spinner.show();
    this.vncService.connect(this.tab?.id, this.tab?.profile?.vncProfile, this.vncContainer).then(
      () => this.spinner.hide()
    );
  }

  disconnect() {
    this.vncService.disconnect(this.tab?.id);
  }

  showRealSize() {

  }

  resizeToFit() {
  }
}
