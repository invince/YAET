import { CommonModule } from '@angular/common';
import { Component, Inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';

export interface FileEditorData {
  fileName: string;
  content: string;
}

@Component({
    selector: 'app-file-editor-dialog',
    imports: [
        CommonModule,
        FormsModule,
        MatDialogModule,
        MatButtonModule,
        MatFormFieldModule,
        MatInputModule
    ],
    template: `
    <h2 mat-dialog-title>Edit {{data.fileName}}</h2>
    <mat-dialog-content class="editor-content">
      <textarea [(ngModel)]="editedContent" class="editor-textarea"></textarea>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button (click)="cancel()">Cancel</button>
      <button mat-raised-button color="primary" (click)="save()">Save</button>
    </mat-dialog-actions>
  `,
    styles: [`
    .editor-content {
      min-width: 600px;
      min-height: 450px;
      padding: 16px;
      display: flex;
      flex-direction: column;
    }
    .editor-textarea {
      width: 100%;
      height: 450px;
      font-family: monospace;
      font-size: 14px;
      padding: 12px;
      border: 1px solid #424242;
      background-color: #1e1e1e;
      color: #e0e0e0;
      resize: none;
      overflow: auto;
      box-sizing: border-box;
    }
    .editor-textarea:focus {
      outline: none;
      border-color: #3f51b5;
    }
  `]
})
export class FileEditorDialogComponent {
  editedContent: string;

  constructor(
    public dialogRef: MatDialogRef<FileEditorDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: FileEditorData
  ) {
    // Store a copy of the original content
    this.editedContent = data.content;
  }

  cancel() {
    this.dialogRef.close(null);
  }

  save() {
    this.dialogRef.close(this.editedContent);
  }
}
