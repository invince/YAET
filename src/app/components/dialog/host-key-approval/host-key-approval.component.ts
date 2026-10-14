import {CommonModule} from '@angular/common';
import {Component, Inject} from '@angular/core';
import {MAT_DIALOG_DATA, MatDialogModule, MatDialogRef} from '@angular/material/dialog';
import {MatButtonModule} from '@angular/material/button';
import {MatIcon} from '@angular/material/icon';
import {TranslateModule} from '@ngx-translate/core';

export interface HostKeyPromptData {
  id: string;
  /** 'UNKNOWN' (first sight) | 'CHANGED' (key rotation or MITM) */
  status: string;
  /** 'target' | 'jumper' — which leg of the connection presented the key */
  leg: string;
  host: string;
  port: number;
  keyType: string;
  base64: string;
  sha256: string;
  md5: string;
  randomart: string;
}

export type HostKeyChoice = 'cancel' | 'once' | 'save';

@Component({
  selector: 'app-host-key-approval',
  standalone: true,
  imports: [CommonModule, MatDialogModule, MatButtonModule, MatIcon, TranslateModule],
  templateUrl: './host-key-approval.component.html',
  styleUrl: './host-key-approval.component.scss'
})
export class HostKeyApprovalComponent {
  constructor(
    private dialogRef: MatDialogRef<HostKeyApprovalComponent>,
    @Inject(MAT_DIALOG_DATA) public data: HostKeyPromptData,
  ) { }

  get changed(): boolean {
    return this.data.status === 'CHANGED';
  }

  cancel(): void {
    this.dialogRef.close('cancel');
  }

  connectOnce(): void {
    this.dialogRef.close('once');
  }

  saveAndConnect(): void {
    this.dialogRef.close('save');
  }
}
