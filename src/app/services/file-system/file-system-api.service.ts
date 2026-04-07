import {HttpClient, HttpHeaders} from '@angular/common/http';
import {Injectable} from '@angular/core';
import {Observable} from 'rxjs';

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

    private headers(authHeader?: string): { headers?: HttpHeaders } {
        if (!authHeader) return {};
        return { headers: new HttpHeaders({ Authorization: authHeader }) };
    }

    read(url: string, path: string, authHeader?: string): Observable<FileSystemResponse> {
        return this.http.post<FileSystemResponse>(url, {
            action: 'read',
            path: path,
            showHiddenItems: true,
            data: []
        }, this.headers(authHeader));
    }

    create(url: string, path: string, name: string, type: 'folder' | 'file', authHeader?: string): Observable<FileSystemResponse> {
        return this.http.post<FileSystemResponse>(url, {
            action: 'create',
            path: path,
            name: name,
            type: type,
            data: []
        }, this.headers(authHeader));
    }

    delete(url: string, path: string, items: FileItem[], authHeader?: string): Observable<FileSystemResponse> {
        return this.http.post<FileSystemResponse>(url, {
            action: 'delete',
            path: path,
            data: items
        }, this.headers(authHeader));
    }

    rename(url: string, path: string, name: string, newName: string, authHeader?: string): Observable<FileSystemResponse> {
        return this.http.post<FileSystemResponse>(url, {
            action: 'rename',
            path: path,
            name: name,
            newName: newName,
            data: []
        }, this.headers(authHeader));
    }

    download(url: string, path: string, names: string[], authHeader?: string): Observable<Blob> {
        const payload = { path, names };
        return this.http.post(url, { downloadInput: JSON.stringify(payload) }, {
            responseType: 'blob',
            ...this.headers(authHeader)
        });
    }

    upload(url: string, path: string, file: File, overwrite: boolean = false, authHeader?: string): Observable<any> {
        const formData = new FormData();
        formData.append('data', JSON.stringify({ name: path }));
        formData.append('filename', file.name);
        formData.append('uploadFiles', file);
        if (overwrite) {
            formData.append('overwrite', 'true');
        }
        return this.http.post(url, formData, this.headers(authHeader));
    }

    copy(url: string, sourcePath: string, targetPath: string, names: string[], authHeader?: string): Observable<FileSystemResponse> {
        return this.http.post<FileSystemResponse>(url, {
            action: 'copy',
            path: sourcePath,
            targetPath: targetPath,
            names: names,
            data: []
        }, this.headers(authHeader));
    }

    move(url: string, sourcePath: string, targetPath: string, names: string[], authHeader?: string): Observable<FileSystemResponse> {
        return this.http.post<FileSystemResponse>(url, {
            action: 'move',
            path: sourcePath,
            targetPath: targetPath,
            names: names,
            data: []
        }, this.headers(authHeader));
    }
}
