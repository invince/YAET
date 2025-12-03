import { Injectable } from '@angular/core';
import { FileItem } from './file-system/file-system-api.service';

export interface DragSourceInfo {
    ajaxSettings: any;
    path: string;
    files: FileItem[];
}

@Injectable({
    providedIn: 'root'
})
export class DragDropTransferService {
    private dragSource: DragSourceInfo | null = null;
    private _isDragging = false;

    get isDragging(): boolean {
        return this._isDragging;
    }

    startDrag(ajaxSettings: any, path: string, files: FileItem[]): void {
        this.dragSource = {
            ajaxSettings,
            path,
            files
        };
        this._isDragging = true;
    }

    endDrag(): void {
        this.dragSource = null;
        this._isDragging = false;
    }

    getDragData(): DragSourceInfo | null {
        return this.dragSource;
    }

    canTransfer(targetSettings: any): boolean {
        if (!this.dragSource) return false;

        // Check if source and target are different connections
        // Compare by URL to determine if it's a cross-connection transfer
        return this.dragSource.ajaxSettings?.url !== targetSettings?.url;
    }

    isSameConnection(targetSettings: any): boolean {
        if (!this.dragSource) return false;
        return this.dragSource.ajaxSettings?.url === targetSettings?.url;
    }
}
