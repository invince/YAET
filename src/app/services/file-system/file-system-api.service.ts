import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

export interface FileItem {
    name: string;
    type: 'file' | 'folder';
    isFile: boolean;
    size: number;
    dateModified: string;
    permission?: string;
}

export interface FileSystemResponse {
    cwd: {
        name: string;
        type: string;
    };
    files: FileItem[];
    error?: {
        code: number;
        message: string;
    };
}

@Injectable({
    providedIn: 'root'
})
export class FileSystemApiService {

    constructor(private http: HttpClient) { }

    read(url: string, path: string): Observable<FileSystemResponse> {
        return this.http.post<FileSystemResponse>(url, {
            action: 'read',
            path: path,
            showHiddenItems: true,
            data: []
        });
    }

    create(url: string, path: string, name: string, type: 'folder' | 'file'): Observable<FileSystemResponse> {
        return this.http.post<FileSystemResponse>(url, {
            action: 'create',
            path: path,
            name: name,
            type: type,
            data: []
        });
    }

    delete(url: string, path: string, items: FileItem[]): Observable<FileSystemResponse> {
        return this.http.post<FileSystemResponse>(url, {
            action: 'delete',
            path: path,
            data: items
        });
    }

    rename(url: string, path: string, name: string, newName: string): Observable<FileSystemResponse> {
        return this.http.post<FileSystemResponse>(url, {
            action: 'rename',
            path: path,
            name: name,
            newName: newName,
            data: []
        });
    }

    download(url: string, path: string, names: string[]): Observable<Blob> {
        const payload = {
            path: path,
            names: names
        };
        return this.http.post(url, { downloadInput: JSON.stringify(payload) }, { responseType: 'blob' });
    }

    upload(url: string, path: string, file: File, overwrite: boolean = false): Observable<any> {
        const formData = new FormData();
        formData.append('data', JSON.stringify({ name: path }));
        formData.append('filename', file.name);
        formData.append('uploadFiles', file);
        if (overwrite) {
            formData.append('overwrite', 'true');
        }

        return this.http.post(url, formData);
    }

    copy(url: string, sourcePath: string, targetPath: string, names: string[]): Observable<FileSystemResponse> {
        return this.http.post<FileSystemResponse>(url, {
            action: 'copy',
            path: sourcePath,
            targetPath: targetPath,
            names: names,
            data: []
        });
    }

    move(url: string, sourcePath: string, targetPath: string, names: string[]): Observable<FileSystemResponse> {
        return this.http.post<FileSystemResponse>(url, {
            action: 'move',
            path: sourcePath,
            targetPath: targetPath,
            names: names,
            data: []
        });
    }
}
