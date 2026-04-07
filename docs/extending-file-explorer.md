# Extending the File Explorer

This document explains how to add support for a new remote file system protocol (e.g., WebDAV, S3) into the YAET File Explorer component.

## 1. Domain Model (`src/app/domain/session/`)

First, create a session domain model for your new protocol. This model should store all relevant connection parameters such as host, port, username, and password.

Example: `src/app/domain/session/WebDavSession.ts`
```typescript
import { BaseSession } from './BaseSession';

export class WebDavSession extends BaseSession {
  public url?: string;
  public username?: string;
  public password?: string;
  
  constructor() {
    super();
    this.sessionType = 'WEBDAV';
  }
}
```

## 2. File Explorer Service (`src/app/services/file-explorer/`)

Create an Angular service that implements your protocol's file operations (list, upload, download, delete, etc.). It should encapsulate the backend or node API calls.

Example: `src/app/services/file-explorer/webdav.service.ts`
```typescript
import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class WebDavService {
  async listFiles(session: WebDavSession, path: string) {
    // Interop with Electron IPC or Native Node APIs
  }
  
  // Implement readFile, writeFile, deleteFile, renameFile...
}
```

## 3. UI Component (`src/app/components/file-explorer/`)

Create the specific component folder for your protocol under `src/app/components/file-explorer/`.
Usually, this wraps the generic `FileListComponent` but injects the proper service data.

Example: `src/app/components/file-explorer/webdav/webdav.component.ts`
```typescript
import { Component, Input } from '@angular/core';
import { WebDavSession } from '../../../../domain/session/WebDavSession';

@Component({
  selector: 'app-webdav-explorer',
  templateUrl: './webdav.component.html'
})
export class WebDavExplorerComponent {
  @Input() session!: WebDavSession;
  
  // Bind your WebDavService to load data into the shared file-list layout
}
```

## 4. Integration

1.  **Main Explorer Switcher**: Add your new component in `src/app/components/file-explorer/file-explorer.component.html` using a switch case on `session.sessionType`.
2.  **Profile Menu**: Ensure a form to create the `WebDavSession` is added to the `SecretsMenuComponent` or Profile UI, reusing `EnhancedFormMixin`!
