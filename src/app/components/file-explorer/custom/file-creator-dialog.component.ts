import { CommonModule } from '@angular/common';
import { Component, Inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

export interface FileCreatorData {
    fileName: string;
    content: string;
}

@Component({
    selector: 'app-file-creator-dialog',
    imports: [
        CommonModule,
        FormsModule,
        MatDialogModule,
        MatButtonModule,
        MatFormFieldModule,
        MatInputModule,
        MatProgressSpinnerModule
    ],
    templateUrl: './file-creator-dialog.component.html'
})
export class FileCreatorDialogComponent {
    fileName: string = '';
    content: string = '';
    isSaving: boolean = false;

    constructor(
        public dialogRef: MatDialogRef<FileCreatorDialogComponent>,
        @Inject(MAT_DIALOG_DATA) public data: FileCreatorData
    ) {
        if (data) {
            this.fileName = data.fileName || '';
            this.content = data.content || '';
        }
    }

    onCancel(): void {
        this.dialogRef.close();
    }

    onSave(): void {
        if (this.fileName.trim()) {
            this.isSaving = true;
            this.dialogRef.close({ fileName: this.fileName.trim(), content: this.content, saving: true });
        }
    }
}
