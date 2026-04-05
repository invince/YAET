import {Component, Optional} from '@angular/core';
import {DynamicDialogConfig, DynamicDialogModule, DynamicDialogRef} from 'primeng/dynamicdialog';
import {ButtonModule} from 'primeng/button';

@Component({
    selector: 'app-confirmation',
    imports: [
        ButtonModule,
        DynamicDialogModule
    ],
    templateUrl: './confirmation.component.html',
    styleUrl: './confirmation.component.css'
})
export class ConfirmationComponent {

  constructor(
    @Optional() public ref: DynamicDialogRef,
    @Optional() public config: DynamicDialogConfig
  ) {}

  get data(): { message: string; okBtnLabel: string; abortBtnLabel: string } {
    return this.config.data || {} as any;
  }

  onAbort(): void {
    this.ref?.close(false);
  }

  onContinue(): void {
    this.ref?.close(true);
  }
}
