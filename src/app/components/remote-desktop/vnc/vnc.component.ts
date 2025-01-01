import {AfterViewInit, Component, ElementRef, Input, OnChanges, SimpleChanges, ViewChild} from '@angular/core';
import {NgxSpinnerService} from 'ngx-spinner';
import {MatSnackBar} from '@angular/material/snack-bar';
import {Session} from '../../../domain/session/Session';


@Component({
  selector: 'app-vnc',
  standalone: true,
  imports: [],
  templateUrl: './vnc.component.html',
  styleUrl: './vnc.component.css'
})
export class VncComponent implements AfterViewInit, OnChanges {

  @Input() session!: Session;
  private isViewInitialized = false;

  status: string = 'disconnected';

  constructor(
    private spinner: NgxSpinnerService,
    private _snackBar: MatSnackBar,
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
    this.session.open(this.vncContainer);
  }

  disconnect() {
    this.session.close();
  }

  showRealSize() {

  }

  resizeToFit() {
  }
}
