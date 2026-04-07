# Extending the Terminal

This guide explains how to add new terminal features, customize the PTY backend, or integrate new terminal Add-ons in YAET.

## 1. Understanding the Terminal Architecture

YAET builds on top of **Xterm.js** and connects to native shells via **Node-pty** (or via SSH streams).

- **Frontend Component**: `src/app/components/terminal/terminal.component.ts` initializes Xterm.js arrays and manages UI fitting.
- **Backend Bridge**: `src-electron/electronMain.js` or backend IPC services expose native shell/pty functions to the Angular frontend.

## 2. Adding an Xterm.js Addon

If you want to add a feature like search, WebGL acceleration, or custom links:
1.  Install the addon via npm `npm i @xterm/addon-<name>`.
2.  Import it in `terminal.component.ts`.
3.  Load the addon during Xterm initialization:

```typescript
import { SearchAddon } from '@xterm/addon-search';

// Inside terminal.component.ts -> ngOnInit or terminal initialization block
const searchAddon = new SearchAddon();
this.terminal.loadAddon(searchAddon);
```

## 3. Implementing a New Shell Backend

To support a custom shell or remote execution environment (e.g., a direct AWS SSM session terminal):

### Backend (Electron)
In `src-electron/`, expose an IPC channel that spawns the custom environment over `node-pty`:
```javascript
ipcMain.on('pty-spawn-aws-ssm', (event, ssmTarget) => {
  const ptyProcess = pty.spawn('aws', ['ssm', 'start-session', '--target', ssmTarget]);
  ptyProcess.on('data', data => event.sender.send('pty-out', data));
  ipcMain.on('pty-in', (e, input) => ptyProcess.write(input));
});
```

### Frontend (Angular)
In `terminal.component.ts`, establish the listener:
```typescript
startAwsSsmTerminal(target: string) {
  // Clear existing terminal
  this.terminal.clear();
  
  // Listen to output
  window.electronAPI.onPtyOut((data) => {
    this.terminal.write(data);
  });

  // Pipe input
  this.terminal.onData((input) => {
    window.electronAPI.sendPtyIn(input);
  });
  
  // Trigger creation
  window.electronAPI.spawnAwsSsm(target);
}
```

## 4. Hooking it to the UI

Create a new menu item, or Session Profile (similar to SSH and Local Terminal profiles) that triggers `startAwsSsmTerminal` dynamically when clicked in the sidebar.
