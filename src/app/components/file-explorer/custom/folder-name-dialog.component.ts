import { CommonModule } from '@angular/common';
import { Component, Inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';

@Component({
    selector: 'app-folder-name-dialog',
    imports: [
        CommonModule,
        FormsModule,
        MatDialogModule,
        MatButtonModule,
        MatFormFieldModule,
        MatInputModule
    ],
    template: `
    <h2 mat-dialog-title>{{ data?.title || 'Create New Folder' }}</h2>
    <mat-dialog-content>
      <mat-form-field appearance="fill" class="full-width">
        <mat-label>{{ data?.label || 'Folder Name' }}</mat-label>
        <input matInput [(ngModel)]="name" (keydown.enter)="create()" autofocus />
      </mat-form-field>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button (click)="cancel()">Cancel</button>
      <button mat-raised-button color="primary" (click)="create()" [disabled]="!name || !name.trim()">Create</button>
    </mat-dialog-actions>
  `,
    styles: [`
    .full-width {
      width: 100%;
      min-width: 300px;
    }
  `]
})
export class FolderNameDialogComponent {
    name = '';

    constructor(
        public dialogRef: MatDialogRef<FolderNameDialogComponent>,
        @Inject(MAT_DIALOG_DATA) public data: any
    ) { }

    cancel() {
        this.dialogRef.close(null);
    }

    create() {
        if (this.name && this.name.trim()) {
            this.dialogRef.close(this.name.trim());
        }
    }
}
