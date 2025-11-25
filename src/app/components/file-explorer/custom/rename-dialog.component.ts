import { CommonModule } from '@angular/common';
import { Component, Inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';

export interface RenameDialogData {
    currentName: string;
    type: 'file' | 'folder';
}

@Component({
    selector: 'app-rename-dialog',
    standalone: true,
    imports: [
        CommonModule,
        FormsModule,
        MatDialogModule,
        MatButtonModule,
        MatFormFieldModule,
        MatInputModule
    ],
    template: `
        <h2 mat-dialog-title>Rename {{ data.type === 'folder' ? 'Folder' : 'File' }}</h2>
        <mat-dialog-content>
            <mat-form-field appearance="outline" style="width: 100%;">
                <mat-label>New Name</mat-label>
                <input matInput [(ngModel)]="newName" autofocus (keydown.enter)="onSave()">
            </mat-form-field>
        </mat-dialog-content>
        <mat-dialog-actions align="end">
            <button mat-button (click)="onCancel()">Cancel</button>
            <button mat-raised-button color="primary" (click)="onSave()" [disabled]="!newName.trim()">Rename</button>
        </mat-dialog-actions>
    `
})
export class RenameDialogComponent {
    newName: string;

    constructor(
        public dialogRef: MatDialogRef<RenameDialogComponent>,
        @Inject(MAT_DIALOG_DATA) public data: RenameDialogData
    ) {
        this.newName = data.currentName;
    }

    onCancel(): void {
        this.dialogRef.close();
    }

    onSave(): void {
        if (this.newName.trim() && this.newName !== this.data.currentName) {
            this.dialogRef.close(this.newName.trim());
        }
    }
}
