import {CommonModule} from '@angular/common';
import {Component, Inject} from '@angular/core';
import {MAT_DIALOG_DATA, MatDialogModule, MatDialogRef} from '@angular/material/dialog';
import {MatButtonModule} from '@angular/material/button';
import {MatIcon} from '@angular/material/icon';
import {TranslateModule} from '@ngx-translate/core';

export interface TunnelApprovalData {
  tunnelId: string;
  tunnelName: string;
  srcIP: string;
  srcPort: number;
  dstPort: number;
}

@Component({
  selector: 'app-tunnel-approval',
  standalone: true,
  imports: [CommonModule, MatDialogModule, MatButtonModule, MatIcon, TranslateModule],
  templateUrl: './tunnel-approval.component.html',
  styleUrl: './tunnel-approval.component.scss'
})
export class TunnelApprovalComponent {
  constructor(
    private dialogRef: MatDialogRef<TunnelApprovalComponent>,
    @Inject(MAT_DIALOG_DATA) public data: TunnelApprovalData,
  ) { }

  allowOnce(): void {
    this.dialogRef.close('once');
  }

  trustSource(): void {
    this.dialogRef.close('trust');
  }

  deny(): void {
    this.dialogRef.close('deny');
  }
}
