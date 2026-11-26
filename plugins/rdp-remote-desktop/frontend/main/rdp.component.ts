import {AfterViewInit, Component, ElementRef, Input, OnDestroy, ViewChild} from '@angular/core';
import {Session} from '../../../../src/app/domain/session/Session';
import {TabService} from '../../../../src/app/services/tab.service';

@Component({
  selector: 'app-rdp',
  imports: [],
  templateUrl: './rdp.component.html',
  styleUrl: './rdp.component.scss',
})
export class RdpComponent implements AfterViewInit, OnDestroy {
  @Input() session!: Session;

  @ViewChild('rdp', {static: true}) canvasRef!: ElementRef<HTMLCanvasElement>;

  constructor(private tabService: TabService) {
  }

  ngAfterViewInit(): void {
    this.session.open(this.canvasRef);
  }

  ngOnDestroy(): void {
    const isTabStillActive = this.tabService.tabs.some(t => t.id === this.session.id);
    if (!isTabStillActive) {
      this.session.close();
    }
  }
}
