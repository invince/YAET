import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, OnInit, Output, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatDividerModule } from '@angular/material/divider';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatMenuModule } from '@angular/material/menu';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSort, MatSortModule } from '@angular/material/sort';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { DragDropTransferService } from '../../../services/drag-drop-transfer.service';
import { FileItem, FileSystemApiService } from '../../../services/file-system/file-system-api.service';
import { FileCreatorDialogComponent } from './file-creator-dialog.component';
import { FileEditorDialogComponent } from './file-editor-dialog.component';
import { FolderNameDialogComponent } from './folder-name-dialog.component';
import { RenameDialogComponent } from './rename-dialog.component';

@Component({
    selector: 'app-file-list',
    imports: [
        CommonModule,
        MatTableModule,
        MatIconModule,
        MatButtonModule,
        MatMenuModule,
        MatProgressBarModule,
        MatProgressSpinnerModule,
        MatSortModule,
        MatDialogModule,
        MatDividerModule,
        FormsModule,
        MatInputModule,
        MatFormFieldModule
    ],
    templateUrl: './file-list.component.html',
    styleUrls: ['./file-list.component.scss']
})
export class FileListComponent implements OnInit {
    @Input() ajaxSettings: any;
    @Input() path: string = '/';
    @Output() pathChange = new EventEmitter<string>();

    dataSource = new MatTableDataSource<FileItem>([]);
    displayedColumns: string[] = ['icon', 'name', 'size', 'dateModified', 'actions'];
    isLoading = false;
    isEditingPath = false;
    editPath = '';
    isSaving = false;
    clipboard: FileItem[] = [];
    clipboardMode: 'copy' | 'cut' | null = null;
    clipboardSourcePath = '';
    isDraggingOver = false;
    isDraggingFromAnotherTab = false;
    draggedItem: FileItem | null = null;
    dragOverFolder: FileItem | null = null;

    // Column resizing
    isResizing = false;
    resizingColumn: string | null = null;
    startX = 0;
    startWidth = 0;
    columnWidths: { [key: string]: number } = {
        icon: 60,
        name: 400,
        size: 120,
        dateModified: 180,
        actions: 60
    };

    @ViewChild(MatSort) sort!: MatSort;

    constructor(
        private api: FileSystemApiService,
        private dialog: MatDialog,
        private dragDropService: DragDropTransferService
    ) { }

    ngOnInit(): void {
        this.refresh();
    }

    ngAfterViewInit() {
        this.dataSource.sort = this.sort;
    }

    refresh() {
        if (!this.ajaxSettings?.url) return;
        this.isLoading = true;
        this.api.read(this.ajaxSettings.url, this.path).subscribe({
            next: (res) => {
                this.dataSource.data = res.files;
                this.isLoading = false;
                // Update path if changed by server (e.g. normalization)
                if (res.cwd && res.cwd.name !== this.path) {
                    this.path = res.cwd.name;
                    this.pathChange.emit(this.path);
                }
            },
            error: (err) => {
                console.error('Error loading files', err);
                this.isLoading = false;
            }
        });
    }

    navigate(item: FileItem) {
        if (item.type === 'folder') {
            // Ensure path ends with / before appending if not root
            const separator = this.path.endsWith('/') ? '' : '/';
            this.path = `${this.path}${separator}${item.name}`;
            this.pathChange.emit(this.path);
            this.refresh();
        } else if (item.type === 'file') {
            // Check if it's a text-based file
            const isTextFile = this.isTextBasedFile(item.name);

            if (isTextFile) {
                // Open in edit mode
                this.editFile(item);
            } else {
                // Download the file
                this.download(item);
            }
        }
    }

    private isTextBasedFile(filename: string): boolean {
        const lowerName = filename.toLowerCase();

        // Common text file extensions
        const textExtensions = [
            '.txt', '.md', '.json', '.xml', '.yaml', '.yml',
            '.js', '.ts', '.jsx', '.tsx', '.css', '.scss', '.sass', '.less',
            '.html', '.htm', '.svg',
            '.sh', '.bash', '.zsh', '.fish',
            '.py', '.rb', '.php', '.java', '.c', '.cpp', '.h', '.hpp',
            '.go', '.rs', '.swift', '.kt',
            '.sql', '.csv', '.tsv',
            '.log', '.conf', '.config', '.ini', '.env',
            '.gitignore', '.dockerignore', '.editorconfig'
        ];

        // Check if file has a text extension
        if (textExtensions.some(ext => lowerName.endsWith(ext))) {
            return true;
        }

        // Check for files without extensions that are typically text files
        const textFilesWithoutExt = [
            'dockerfile', 'makefile', 'rakefile', 'gemfile',
            '.bashrc', '.bash_profile', '.zshrc', '.profile',
            '.vimrc', '.gitconfig', '.npmrc', '.yarnrc',
            'readme', 'license', 'changelog', 'contributing'
        ];

        return textFilesWithoutExt.some(name => lowerName === name || lowerName.endsWith('/' + name));
    }

    navigateUp() {
        if (this.path === '/') return;
        const parts = this.path.split('/').filter(p => p);
        parts.pop();
        this.path = parts.length > 0 ? '/' + parts.join('/') : '/';
        this.pathChange.emit(this.path);
        this.refresh();
    }

    formatSize(bytes: number): string {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    download(item: FileItem) {
        if (!this.ajaxSettings?.downloadUrl) return;

        const separator = this.path.endsWith('/') ? '' : '/';
        const fullPath = `${this.path}${separator}`;

        this.api.download(this.ajaxSettings.downloadUrl, fullPath, [item.name]).subscribe(blob => {
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = item.name;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
        });
    }

    deleteItem(item: FileItem) {
        if (!confirm(`Are you sure you want to delete ${item.name}?`)) return;

        const separator = this.path.endsWith('/') ? '' : '/';
        const fullPath = `${this.path}${separator}`;

        this.api.delete(this.ajaxSettings.url, fullPath, [item]).subscribe(() => {
            this.refresh();
        });
    }

    renameItem(item: FileItem) {
        const dialogRef = this.dialog.open(RenameDialogComponent, {
            width: '400px',
            data: { currentName: item.name, type: item.type }
        });

        dialogRef.afterClosed().subscribe(newName => {
            if (newName) {
                const separator = this.path.endsWith('/') ? '' : '/';
                const fullPath = `${this.path}${separator}`;

                this.isSaving = true;
                this.api.rename(this.ajaxSettings.url, fullPath, item.name, newName).subscribe({
                    next: () => {
                        this.isSaving = false;
                        this.refresh();
                    },
                    error: (err: any) => {
                        this.isSaving = false;
                        console.error('Error renaming item', err);
                        alert('Failed to rename item: ' + (err.error?.error?.message || err.message));
                    }
                });
            }
        });
    }

    createFolder() {
        const dialogRef = this.dialog.open(FolderNameDialogComponent, {
            width: '400px'
        });

        dialogRef.afterClosed().subscribe(folderName => {
            if (folderName) {
                const separator = this.path.endsWith('/') ? '' : '/';
                const fullPath = `${this.path}${separator}`;

                this.api.create(this.ajaxSettings.url, fullPath, folderName, 'folder').subscribe({
                    next: () => {
                        this.refresh();
                    },
                    error: (err: any) => {
                        console.error('Error creating folder', err);
                        alert('Failed to create folder');
                    }
                });
            }
        });
    }

    createFile() {
        const dialogRef = this.dialog.open(FileCreatorDialogComponent, {
            width: '500px',
            data: { fileName: '', content: '' }
        });

        dialogRef.afterClosed().subscribe(result => {
            if (result && result.fileName) {
                const separator = this.path.endsWith('/') ? '' : '/';
                const fullPath = `${this.path}${separator}`;

                this.isSaving = true;
                const file = new File([result.content], result.fileName, { type: 'text/plain' });
                this.api.upload(this.ajaxSettings.uploadUrl, fullPath, file).subscribe({
                    next: () => {
                        this.isSaving = false;
                        this.refresh();
                    },
                    error: (err: any) => {
                        this.isSaving = false;
                        console.error('Error creating file', err);
                        alert('Failed to create file');
                    }
                });
            }
        });
    }

    editFile(item: FileItem) {
        if (!this.ajaxSettings?.downloadUrl) return;

        // Download file content first
        const separator = this.path.endsWith('/') ? '' : '/';
        const fullPath = `${this.path}${separator}`;

        this.api.download(this.ajaxSettings.downloadUrl, fullPath, [item.name]).subscribe(blob => {
            const reader = new FileReader();
            reader.onload = () => {
                const content = reader.result as string;
                const dialogRef = this.dialog.open(FileEditorDialogComponent, {
                    width: '800px',
                    data: { fileName: item.name, content: content }
                });

                dialogRef.afterClosed().subscribe(result => {
                    if (result !== null && result !== undefined) {
                        this.isSaving = true;
                        // Delete the original file first to prevent duplicates
                        this.api.delete(this.ajaxSettings.url, fullPath, [item]).subscribe({
                            next: () => {
                                // Then upload the new version
                                const file = new File([result], item.name, { type: 'text/plain' });
                                this.api.upload(this.ajaxSettings.uploadUrl, fullPath, file).subscribe({
                                    next: () => {
                                        this.isSaving = false;
                                        this.refresh();
                                    },
                                    error: (err: any) => {
                                        this.isSaving = false;
                                        console.error('Error saving file', err);
                                        alert('Failed to save file');
                                    }
                                });
                            },
                            error: (err: any) => {
                                this.isSaving = false;
                                console.error('Error deleting original file', err);
                                alert('Failed to delete original file');
                            }
                        });
                    }
                });
            };
            reader.readAsText(blob);
        });
    }

    enablePathEdit() {
        this.editPath = this.path;
        this.isEditingPath = true;
    }

    navigateToPath() {
        if (this.editPath && this.editPath.trim()) {
            this.path = this.editPath.trim();
            this.pathChange.emit(this.path);
            this.isEditingPath = false;
            this.refresh();
        }
    }

    cancelPathEdit() {
        this.isEditingPath = false;
        this.editPath = '';
    }

    copyItems(items: FileItem[]) {
        this.clipboard = items;
        this.clipboardMode = 'copy';
        this.clipboardSourcePath = this.path;
    }

    cutItems(items: FileItem[]) {
        this.clipboard = items;
        this.clipboardMode = 'cut';
        this.clipboardSourcePath = this.path;
    }

    pasteItems() {
        if (this.clipboard.length === 0 || !this.clipboardMode) return;

        const separator = this.path.endsWith('/') ? '' : '/';
        const targetPath = `${this.path}${separator}`;
        const sourceSeparator = this.clipboardSourcePath.endsWith('/') ? '' : '/';
        const sourcePath = `${this.clipboardSourcePath}${sourceSeparator}`;
        const names = this.clipboard.map(item => item.name);

        if (this.clipboardMode === 'copy') {
            this.isSaving = true;
            this.api.copy(this.ajaxSettings.url, sourcePath, targetPath, names).subscribe({
                next: () => {
                    this.isSaving = false;
                    this.refresh();
                },
                error: (err: any) => {
                    this.isSaving = false;
                    console.error('Error copying items', err);
                    alert('Failed to copy items');
                }
            });
        } else if (this.clipboardMode === 'cut') {
            this.isSaving = true;
            this.api.move(this.ajaxSettings.url, sourcePath, targetPath, names).subscribe({
                next: () => {
                    this.isSaving = false;
                    this.clipboard = [];
                    this.clipboardMode = null;
                    this.clipboardSourcePath = '';
                    this.refresh();
                },
                error: (err: any) => {
                    this.isSaving = false;
                    console.error('Error moving items', err);
                    alert('Failed to move items');
                }
            });
        }
    }

    canPaste(): boolean {
        return this.clipboard.length > 0 && this.clipboardMode !== null;
    }

    onDragOver(event: DragEvent) {
        event.preventDefault();
        event.stopPropagation();
        this.isDraggingOver = true;

        // Check if dragging from another tab
        const dragData = this.dragDropService.getDragData();
        this.isDraggingFromAnotherTab = dragData !== null &&
            this.dragDropService.canTransfer(this.ajaxSettings);
    }

    onDragLeave(event: DragEvent) {
        event.preventDefault();
        event.stopPropagation();
        this.isDraggingOver = false;
        this.isDraggingFromAnotherTab = false;
    }

    onDrop(event: DragEvent) {
        event.preventDefault();
        event.stopPropagation();
        this.isDraggingOver = false;
        this.isDraggingFromAnotherTab = false;

        // Check if this is a cross-tab drop
        const dragData = this.dragDropService.getDragData();
        if (dragData && this.dragDropService.canTransfer(this.ajaxSettings)) {
            // Cross-tab transfer
            this.onCrossTabDrop(dragData);
            return;
        }

        // Regular local file drop
        const files = event.dataTransfer?.files;
        if (files && files.length > 0) {
            this.uploadFiles(files);
        }
    }

    uploadFiles(files: FileList) {
        if (!this.ajaxSettings?.uploadUrl) return;

        const separator = this.path.endsWith('/') ? '' : '/';
        const fullPath = `${this.path}${separator}`;

        this.isSaving = true;
        let uploadCount = 0;
        const totalFiles = files.length;

        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            this.api.upload(this.ajaxSettings.uploadUrl, fullPath, file).subscribe({
                next: () => {
                    uploadCount++;
                    if (uploadCount === totalFiles) {
                        this.isSaving = false;
                        this.refresh();
                    }
                },
                error: (err: any) => {
                    uploadCount++;
                    console.error('Error uploading file', file.name, err);
                    if (uploadCount === totalFiles) {
                        this.isSaving = false;
                        this.refresh();
                    }
                    alert(`Failed to upload ${file.name}`);
                }
            });
        }
    }

    // Internal drag and drop for moving files/folders
    onRowDragStart(event: DragEvent, item: FileItem) {
        this.draggedItem = item;

        // Store drag data in service for cross-tab transfers
        this.dragDropService.startDrag(this.ajaxSettings, this.path, [item]);

        if (event.dataTransfer) {
            event.dataTransfer.effectAllowed = 'move';
            event.dataTransfer.setData('text/plain', item.name);
            // Set a custom data type to identify cross-tab drags
            event.dataTransfer.setData('application/x-yaet-file', JSON.stringify({
                fileName: item.name,
                fileType: item.type
            }));
        }
    }

    onRowDragEnd() {
        this.draggedItem = null;
        this.dragOverFolder = null;

        // Clear drag data from service
        this.dragDropService.endDrag();

        // Extra safeguard: ensure cleanup happens even if events fire in unexpected order
        setTimeout(() => {
            if (!this.draggedItem) {
                this.dragOverFolder = null;
            }
        }, 100);
    }

    onFolderDragOver(event: DragEvent, folder: FileItem) {
        // Only allow dropping on folders, not files
        if (folder.type !== 'folder') {
            return;
        }

        if (this.draggedItem && this.draggedItem.name !== folder.name) {
            event.preventDefault();
            event.stopPropagation();
            if (event.dataTransfer) {
                event.dataTransfer.dropEffect = 'move';
            }
            this.dragOverFolder = folder;
        }
    }

    onFolderDragLeave(folder: FileItem) {
        // Only handle folders
        if (folder.type !== 'folder') {
            return;
        }

        // Clear highlight only if we're leaving the folder that's currently highlighted
        if (this.dragOverFolder === folder) {
            this.dragOverFolder = null;
        }
    }

    onFolderDrop(event: DragEvent, targetFolder: FileItem) {
        // Only allow dropping on folders
        if (targetFolder.type !== 'folder') {
            return;
        }

        event.preventDefault();
        event.stopPropagation();
        this.dragOverFolder = null;

        if (this.draggedItem && this.draggedItem.name !== targetFolder.name) {
            const separator = this.path.endsWith('/') ? '' : '/';
            const targetPath = `${this.path}${separator}${targetFolder.name}/`;

            this.isSaving = true;
            this.api.move(this.ajaxSettings.url, this.path + separator, targetPath, [this.draggedItem.name]).subscribe({
                next: () => {
                    this.isSaving = false;
                    this.refresh();
                },
                error: (err: any) => {
                    this.isSaving = false;
                    console.error('Error moving item', err);
                    alert('Failed to move item: ' + (err.error?.error?.message || err.message));
                }
            });
        }

        this.draggedItem = null;
    }

    // Cross-tab file transfer
    private onCrossTabDrop(dragData: any) {
        if (!dragData || !dragData.files || dragData.files.length === 0) return;
        if (!this.ajaxSettings?.uploadUrl || !dragData.ajaxSettings?.downloadUrl) return;

        const separator = this.path.endsWith('/') ? '' : '/';
        const targetPath = `${this.path}${separator}`;
        const sourceSeparator = dragData.path.endsWith('/') ? '' : '/';
        const sourcePath = `${dragData.path}${sourceSeparator}`;

        this.isSaving = true;
        let transferCount = 0;
        const totalFiles = dragData.files.filter((f: FileItem) => f.type === 'file').length;

        if (totalFiles === 0) {
            alert('Folder drag-and-drop is not supported yet. Please drag files only.');
            this.isSaving = false;
            return;
        }

        // Transfer each file
        dragData.files.forEach((file: FileItem) => {
            if (file.type !== 'file') {
                transferCount++;
                return; // Skip folders for now
            }

            // Download from source
            this.api.download(dragData.ajaxSettings.downloadUrl, sourcePath, [file.name]).subscribe({
                next: (blob) => {
                    // Convert blob to File object
                    const fileObj = new File([blob], file.name, { type: blob.type || 'application/octet-stream' });

                    // Upload to target
                    this.api.upload(this.ajaxSettings.uploadUrl, targetPath, fileObj).subscribe({
                        next: () => {
                            transferCount++;
                            if (transferCount === totalFiles) {
                                this.isSaving = false;
                                this.refresh();
                            }
                        },
                        error: (err: any) => {
                            transferCount++;
                            console.error(`Error uploading file ${file.name}`, err);
                            if (transferCount === totalFiles) {
                                this.isSaving = false;
                                this.refresh();
                            }
                            alert(`Failed to upload ${file.name}: ` + (err.error?.error?.message || err.message));
                        }
                    });
                },
                error: (err: any) => {
                    transferCount++;
                    console.error(`Error downloading file ${file.name}`, err);
                    if (transferCount === totalFiles) {
                        this.isSaving = false;
                    }
                    alert(`Failed to download ${file.name}: ` + (err.error?.error?.message || err.message));
                }
            });
        });
    }

    // Column resizing methods
    onResizeStart(event: MouseEvent, column: string): void {
        event.preventDefault();
        event.stopPropagation();

        this.isResizing = true;
        this.resizingColumn = column;
        this.startX = event.pageX;
        this.startWidth = this.columnWidths[column];

        // Add global mouse event listeners
        document.addEventListener('mousemove', this.onResizeMove);
        document.addEventListener('mouseup', this.onResizeEnd);
    }

    onResizeMove = (event: MouseEvent): void => {
        if (!this.isResizing || !this.resizingColumn) return;

        const diff = event.pageX - this.startX;
        const newWidth = Math.max(50, this.startWidth + diff); // Minimum 50px
        this.columnWidths[this.resizingColumn] = newWidth;
    }

    onResizeEnd = (): void => {
        this.isResizing = false;
        this.resizingColumn = null;

        // Remove global mouse event listeners
        document.removeEventListener('mousemove', this.onResizeMove);
        document.removeEventListener('mouseup', this.onResizeEnd);
    }

    getColumnWidth(column: string): string {
        return `${this.columnWidths[column]}px`;
    }
}

