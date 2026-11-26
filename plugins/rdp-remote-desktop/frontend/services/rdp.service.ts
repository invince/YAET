import {ElementRef, Injectable} from '@angular/core';
import init, {
  ClipboardData,
  DesktopSize,
  DeviceEvent,
  Extension,
  InputTransaction,
  RotationUnit,
  Session as RdpWasmSession,
  SessionBuilder,
  SessionTerminationInfo,
  setup,
} from 'ironrdp-wasm';
import {AuthType} from '../../../../src/app/domain/Secret';
import {RdpProfile} from '../../../../src/app/domain/profile/RdpProfile';
import {ElectronRemoteDesktopService} from '../../../../src/app/services/electron/electron-remote-desktop.service';
import {LogService} from '../../../../src/app/services/log.service';
import {SecretStorageService} from '../../../../src/app/services/secret-storage.service';

const WASM_URL = 'assets/ironrdp/rdp_client_bg.wasm';

const SCANCODE_MAP: Record<string, number> = {
  'Escape': 0x01, 'Digit1': 0x02, 'Digit2': 0x03, 'Digit3': 0x04,
  'Digit4': 0x05, 'Digit5': 0x06, 'Digit6': 0x07, 'Digit7': 0x08,
  'Digit8': 0x09, 'Digit9': 0x0A, 'Digit0': 0x0B, 'Minus': 0x0C,
  'Equal': 0x0D, 'Backspace': 0x0E, 'Tab': 0x0F,
  'KeyQ': 0x10, 'KeyW': 0x11, 'KeyE': 0x12, 'KeyR': 0x13,
  'KeyT': 0x14, 'KeyY': 0x15, 'KeyU': 0x16, 'KeyI': 0x17,
  'KeyO': 0x18, 'KeyP': 0x19, 'BracketLeft': 0x1A, 'BracketRight': 0x1B,
  'Enter': 0x1C, 'ControlLeft': 0x1D,
  'KeyA': 0x1E, 'KeyS': 0x1F, 'KeyD': 0x20, 'KeyF': 0x21,
  'KeyG': 0x22, 'KeyH': 0x23, 'KeyJ': 0x24, 'KeyK': 0x25,
  'KeyL': 0x26, 'Semicolon': 0x27, 'Quote': 0x28, 'Backquote': 0x29,
  'ShiftLeft': 0x2A, 'Backslash': 0x2B,
  'KeyZ': 0x2C, 'KeyX': 0x2D, 'KeyC': 0x2E, 'KeyV': 0x2F,
  'KeyB': 0x30, 'KeyN': 0x31, 'KeyM': 0x32, 'Comma': 0x33,
  'Period': 0x34, 'Slash': 0x35, 'ShiftRight': 0x36,
  'NumpadMultiply': 0x37, 'AltLeft': 0x38, 'Space': 0x39,
  'CapsLock': 0x3A,
  'F1': 0x3B, 'F2': 0x3C, 'F3': 0x3D, 'F4': 0x3E,
  'F5': 0x3F, 'F6': 0x40, 'F7': 0x41, 'F8': 0x42,
  'F9': 0x43, 'F10': 0x44,
  'NumLock': 0x45, 'ScrollLock': 0x46,
  'Numpad7': 0x47, 'Numpad8': 0x48, 'Numpad9': 0x49,
  'NumpadSubtract': 0x4A, 'Numpad4': 0x4B, 'Numpad5': 0x4C,
  'Numpad6': 0x4D, 'NumpadAdd': 0x4E, 'Numpad1': 0x4F,
  'Numpad2': 0x50, 'Numpad3': 0x51, 'Numpad0': 0x52,
  'NumpadDecimal': 0x53,
  'F11': 0x57, 'F12': 0x58,
  'NumpadEnter': 0xE01C, 'ControlRight': 0xE01D,
  'NumpadDivide': 0xE035, 'PrintScreen': 0xE037,
  'AltRight': 0xE038, 'Home': 0xE047, 'ArrowUp': 0xE048,
  'PageUp': 0xE049, 'ArrowLeft': 0xE04B, 'ArrowRight': 0xE04D,
  'End': 0xE04F, 'ArrowDown': 0xE050, 'PageDown': 0xE051,
  'Insert': 0xE052, 'Delete': 0xE053,
  'MetaLeft': 0xE05B, 'MetaRight': 0xE05C, 'ContextMenu': 0xE05D,
  'Pause': 0xE11D45,
};

interface RdpSessionHandle {
  session: RdpWasmSession;
  canvas: HTMLCanvasElement;
  cleanups: Array<() => void>;
}

let wasmReady: Promise<unknown> | null = null;

function ensureWasm(): Promise<unknown> {
  if (!wasmReady) {
    const url = new URL(WASM_URL, document.baseURI).href;
    wasmReady = init(url).then((w) => {
      setup('warn');
      return w;
    }).catch((e) => {
      wasmReady = null;
      throw e;
    });
  }
  return wasmReady;
}

@Injectable({
  providedIn: 'root',
})
export class RdpService {
  private sessions = new Map<string, RdpSessionHandle>();
  private generations = new Map<string, number>();

  constructor(
    private log: LogService,
    private secretStorage: SecretStorageService,
    private electron: ElectronRemoteDesktopService,
  ) {
  }

  private resolveCredentials(profile: RdpProfile): { login: string; password: string } {
    if (profile.authType === AuthType.SECRET && profile.secretId) {
      const secret = this.secretStorage.findById(profile.secretId);
      if (secret) {
        return {login: secret.login || profile.login, password: secret.password || ''};
      }
      this.log.warn(`[rdp] secret ${profile.secretId} not found, falling back to inline credentials`);
    }
    return {login: profile.login || '', password: profile.password || ''};
  }

  async connect(id: string, profile: RdpProfile, canvasRef: ElementRef<HTMLCanvasElement>): Promise<void> {
    if (!profile?.host) {
      throw new Error('Invalid RDP profile');
    }
    if (this.sessions.has(id)) {
      this.disconnect(id);
    }
    const generation = (this.generations.get(id) ?? 0) + 1;
    this.generations.set(id, generation);
    const isCurrent = () => this.generations.get(id) === generation;

    await ensureWasm();
    if (!isCurrent()) return;

    const canvas = canvasRef.nativeElement;
    const rect = canvas.getBoundingClientRect();
    const width = Math.max(800, Math.round(rect.width) || 1280);
    const height = Math.max(600, Math.round(rect.height) || 720);
    canvas.width = width;
    canvas.height = height;

    const port = Number(profile.port) || 3389;
    let session: RdpWasmSession | null = null;
    try {
      const proxyPort = await this.electron.openRdpEmbedded(id, profile.host, port);
      if (!isCurrent()) {
        this.electron.closeRdpSession(id);
        return;
      }
      if (!proxyPort) {
        throw new Error('RDP proxy did not start');
      }

      const {login, password} = this.resolveCredentials(profile);
      const builder = new SessionBuilder();
      builder.username(login);
      builder.password(password);
      if (profile.domain) {
        builder.serverDomain(profile.domain);
      }
      builder.destination(`${profile.host}:${port}`);
      builder.proxyAddress(`ws://127.0.0.1:${proxyPort}`);
      builder.authToken('none');
      builder.desktopSize(new DesktopSize(width, height));
      builder.renderCanvas(canvas);
      builder.extension(new Extension('enable_credssp', true));

      builder.remoteClipboardChangedCallback((data: ClipboardData) => {
        this.copyRemoteClipboardToLocal(data);
      });
      builder.forceClipboardUpdateCallback(async () => {
        if (!session) return;
        try {
          const text = await navigator.clipboard.readText();
          const data = new ClipboardData();
          data.addText('text/plain', text || '');
          await session.onClipboardPaste(data);
        } catch (e) {
          this.log.debug('[rdp] clipboard read failed: ' + e);
        }
      });

      builder.setCursorStyleCallbackContext(canvas);
      builder.setCursorStyleCallback(function (style: string) {
        canvas.style.cursor = style || 'default';
      });

      this.log.info(`[rdp] connecting to ${profile.host}:${port} via ws://127.0.0.1:${proxyPort}`);
      session = await builder.connect();
      if (!isCurrent()) {
        session.shutdown();
        this.electron.closeRdpSession(id);
        return;
      }

      const ds = session.desktopSize();
      canvas.width = ds.width;
      canvas.height = ds.height;

      const cleanups = this.setupInput(canvas, session);

      const observer = new ResizeObserver(() => {
        const r = canvas.getBoundingClientRect();
        const w = Math.round(r.width);
        const h = Math.round(r.height);
        if (w < 2 || h < 2) return;
        if (Math.abs(w - canvas.width) < 8 && Math.abs(h - canvas.height) < 8) return;
        try {
          canvas.width = w;
          canvas.height = h;
          session?.resize(w, h);
        } catch (e) {
          this.log.debug('[rdp] resize failed: ' + e);
        }
      });
      observer.observe(canvas);
      cleanups.push(() => observer.disconnect());

      const onBlur = () => {
        try { session?.releaseAllInputs(); } catch (_) { /* ignore */ }
      };
      window.addEventListener('blur', onBlur);
      cleanups.push(() => window.removeEventListener('blur', onBlur));

      this.sessions.set(id, {session, canvas, cleanups});
      canvas.focus();

      session.run().then((info: SessionTerminationInfo) => {
        this.log.info('[rdp] session ended: ' + info.reason());
        this.cleanup(id);
      }).catch((e: unknown) => {
        this.log.warn('[rdp] session error: ' + e);
        this.cleanup(id);
      });
    } catch (e) {
      this.electron.closeRdpSession(id);
      throw e;
    }
  }

  private copyRemoteClipboardToLocal(data: ClipboardData) {
    try {
      if (!data || data.isEmpty()) return;
      for (const item of data.items()) {
        if (item.mimeType().startsWith('text/')) {
          const value = item.value();
          if (typeof value === 'string') {
            navigator.clipboard.writeText(value).catch((e) => {
              this.log.debug('[rdp] local clipboard write failed: ' + e);
            });
          }
          return;
        }
      }
    } catch (e) {
      this.log.debug('[rdp] remote clipboard parse failed: ' + e);
    }
  }

  private setupInput(canvas: HTMLCanvasElement, session: RdpWasmSession): Array<() => void> {
    const cleanups: Array<() => void> = [];

    const apply = (event: any) => {
      try {
        const tx = new InputTransaction();
        tx.addEvent(event);
        session.applyInputs(tx);
      } catch (e) {
        this.log.debug('[rdp] input failed: ' + e);
      }
    };

    const add = <K extends keyof HTMLElementEventMap>(
      type: K,
      handler: (e: HTMLElementEventMap[K]) => void,
      options?: AddEventListenerOptions,
    ) => {
      canvas.addEventListener(type, handler as EventListener, options);
      cleanups.push(() => canvas.removeEventListener(type, handler as EventListener, options));
    };

    add('keydown', (e) => {
      const scancode = SCANCODE_MAP[e.code];
      if (scancode === undefined) return;
      e.preventDefault();
      e.stopPropagation();
      apply(DeviceEvent.keyPressed(scancode));
    });

    add('keyup', (e) => {
      const scancode = SCANCODE_MAP[e.code];
      if (scancode === undefined) return;
      e.preventDefault();
      e.stopPropagation();
      apply(DeviceEvent.keyReleased(scancode));
    });

    add('mousemove', (e) => {
      const r = canvas.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) return;
      const x = Math.round((e.clientX - r.left) * (canvas.width / r.width));
      const y = Math.round((e.clientY - r.top) * (canvas.height / r.height));
      apply(DeviceEvent.mouseMove(x, y));
    });

    add('mousedown', (e) => {
      e.preventDefault();
      canvas.focus();
      apply(DeviceEvent.mouseButtonPressed(e.button));
    });

    add('mouseup', (e) => {
      e.preventDefault();
      apply(DeviceEvent.mouseButtonReleased(e.button));
    });

    add('wheel', (e) => {
      e.preventDefault();
      if (e.deltaY !== 0) {
        apply(DeviceEvent.wheelRotations(true, e.deltaY > 0 ? -1 : 1, RotationUnit.Line));
      }
      if (e.deltaX !== 0) {
        apply(DeviceEvent.wheelRotations(false, e.deltaX > 0 ? -1 : 1, RotationUnit.Line));
      }
    }, {passive: false});

    add('contextmenu', (e) => e.preventDefault());

    return cleanups;
  }

  private cleanup(id: string) {
    const handle = this.sessions.get(id);
    if (!handle) return;
    this.sessions.delete(id);
    handle.cleanups.forEach((fn) => {
      try { fn(); } catch (_) { /* ignore */ }
    });
  }

  isConnected(id: string): boolean {
    return this.sessions.has(id);
  }

  disconnect(id: string) {
    this.generations.set(id, (this.generations.get(id) ?? 0) + 1);
    const handle = this.sessions.get(id);
    if (handle) {
      try { handle.session.shutdown(); } catch (_) { /* ignore */ }
    }
    this.cleanup(id);
    this.electron.closeRdpSession(id);
  }
}
