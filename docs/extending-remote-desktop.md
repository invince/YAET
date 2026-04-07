# Extending Remote Desktop Capabilities

This document outlines the process for adding support for a new remote desktop protocol (e.g., SPICE, NoMachine) alongside the existing implementations like VNC and RDP.

## 1. Core Profile Domain

First, define the connection profile for your protocol. 
Create `src/app/domain/session/SpiceSession.ts`.

```typescript
import { BaseSession } from './BaseSession';

export class SpiceSession extends BaseSession {
  public host!: string;
  public port!: number;
  public password?: string;
  
  constructor() {
    super();
    this.sessionType = 'SPICE';
  }
}
```

## 2. Remote Desktop Component

Create the canvas or player component that will render the remote desktop stream.
Location: `src/app/components/remote-desktop/<protocol>/`

For example, using a WebSockets stream translated from SPICE:
`src/app/components/remote-desktop/spice/spice.component.ts`

```typescript
import { Component, ElementRef, Input, OnInit, ViewChild } from '@angular/core';
import { SpiceSession } from '../../../../domain/session/SpiceSession';
// import { SpiceClient } from 'some-spice-lib';

@Component({
  selector: 'app-spice-desktop',
  template: `<div #spiceContainer class="desktop-container"></div>`
})
export class SpiceDesktopComponent implements OnInit {
  @Input() session!: SpiceSession;
  @ViewChild('spiceContainer', { static: true }) container!: ElementRef;

  ngOnInit() {
    this.connectSpice();
  }

  connectSpice() {
    // 1. Resolve secrets if necessary via SecretStorageService
    // 2. Initialize SPICE client to the container
    // 3. Handle window resizing and keyboard events
  }
}
```

## 3. Profile Form

To allow users to configure and save this connection:
1. Create a form component in `src/app/components/menu/profile-form/` (e.g. `spice-profile-form.component.ts`).
2. Implement it using `ChildFormAsFormControl` (via `EnhancedFormMixin.ts`) to ensure it seamlessly integrates into the main profile creation menu.
3. Define the form elements for `host`, `port`, etc. using `ModelFormController`.

## 4. Main Component Integration

Register your new layout in `app.component.html` or the main workspace view router, ensuring it instantiates when a profile with `sessionType === 'SPICE'` is activated.
