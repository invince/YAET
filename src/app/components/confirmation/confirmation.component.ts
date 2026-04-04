import {Component} from '@angular/core';
import {DynamicDialogConfig, DynamicDialogRef} from 'primeng/dynamicdialog';
import {ButtonModule} from 'primeng/button';

@Component({
    selector: 'app-confirmation',
    imports: [
        ButtonModule
    ],
    templateUrl: './confirmation.component.html',
    styleUrl: './confirmation.component.css'
})
export class ConfirmationComponent {

  constructor(
    public ref: DynamicDialogRef,
    public config: DynamicDialogConfig
  ) {}

  get data(): { message: string; okBtnLabel: string; abortBtnLabel: string } {
    return this.config.data || {} as any;
  }

  onAbort(): void {
    this.ref.close(false);
  }

  onContinue(): void {
    this.ref.close(true);
  }
}
