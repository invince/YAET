import {HostKeyApprovalService} from './host-key-approval.service';
import {HostKeyPromptData} from '../components/dialog/host-key-approval/host-key-approval.component';

describe('HostKeyApprovalService (FIFO host-key queue)', () => {
  let service: HostKeyApprovalService;
  let electron: {
    onHostKeyPrompt: jasmine.Spy;
    addKnownHost: jasmine.Spy;
  };
  let notification: { error: jasmine.Spy };
  let opened: { data: HostKeyPromptData | null }[];
  let closeFns: ((choice: 'cancel' | 'once' | 'save' | undefined) => void)[];
  let hooks: { retry: jasmine.Spy; abort: jasmine.Spy };

  beforeEach(() => {
    opened = [];
    closeFns = [];
    electron = {
      onHostKeyPrompt: jasmine.createSpy('onHostKeyPrompt'),
      addKnownHost: jasmine.createSpy('addKnownHost').and.resolveTo({ ok: true }),
    };
    notification = { error: jasmine.createSpy('error') };
    const dialog = {
      open: jasmine.createSpy('open').and.callFake((_comp: unknown, config: { data: HostKeyPromptData }) => {
        opened.push(config);
        return {
          afterClosed: () => ({
            subscribe: (fn: (choice: 'cancel' | 'once' | 'save' | undefined) => void) => {
              closeFns.push(fn);
            },
          }),
        };
      }),
    };
    hooks = { retry: jasmine.createSpy('retry'), abort: jasmine.createSpy('abort') };
    service = new HostKeyApprovalService(
      electron as never,
      dialog as never,
      { run: (fn: () => void) => fn() } as never,
      { warn: (_msg: string) => {} } as never,
      notification as never,
    );
    service.registerSession('s1', hooks);
  });

  function prompt(id = 's1'): HostKeyPromptData {
    return {
      id, status: 'UNKNOWN', leg: 'target', host: 'example.com', port: 22,
      keyType: 'ssh-ed25519', base64: 'QUJD', sha256: 'SHA256:x', md5: 'm', randomart: 'art',
    };
  }

  async function tick(): Promise<void> {
    await new Promise(r => setTimeout(r, 0));
  }

  it('ensureListening subscribes once', () => {
    service.ensureListening();
    service.ensureListening();
    expect(electron.onHostKeyPrompt).toHaveBeenCalledTimes(1);
  });

  it('opens one dialog at a time (FIFO)', () => {
    service.ensureListening();
    const cb = electron.onHostKeyPrompt.calls.first().args[0] as (r: never) => void;
    cb(prompt('s1') as never);
    cb(prompt('s1') as never);
    expect(opened.length).toBe(1);
    closeFns[0]('cancel');
    expect(opened.length).toBe(2);
  });

  it('save pins the key then retries the session open', async () => {
    service.ensureListening();
    const cb = electron.onHostKeyPrompt.calls.first().args[0] as (r: never) => void;
    cb(prompt() as never);
    closeFns[0]('save');
    await tick();
    expect(electron.addKnownHost).toHaveBeenCalledWith({
      host: 'example.com', port: 22, keyType: 'ssh-ed25519', base64: 'QUJD',
    });
    expect(hooks.retry).toHaveBeenCalledWith();
    expect(hooks.abort).not.toHaveBeenCalled();
  });

  it('once retries with a one-shot trust and writes nothing', async () => {
    service.ensureListening();
    const cb = electron.onHostKeyPrompt.calls.first().args[0] as (r: never) => void;
    cb(prompt() as never);
    closeFns[0]('once');
    await tick();
    expect(electron.addKnownHost).not.toHaveBeenCalled();
    expect(hooks.retry).toHaveBeenCalledWith({ trustOnce: { keyType: 'ssh-ed25519', base64: 'QUJD' } });
  });

  it('cancel and dismiss abort the waiting session', async () => {
    service.ensureListening();
    const cb = electron.onHostKeyPrompt.calls.first().args[0] as (r: never) => void;
    cb(prompt() as never);
    closeFns[0]('cancel');
    await tick();
    expect(hooks.abort).toHaveBeenCalledTimes(1);
    expect(hooks.retry).not.toHaveBeenCalled();
  });

  it('ignores malformed prompts', () => {
    service.ensureListening();
    const cb = electron.onHostKeyPrompt.calls.first().args[0] as (r: never) => void;
    cb({} as never);
    cb(null as never);
    expect(opened.length).toBe(0);
  });

  it('save failure notifies and aborts', async () => {
    electron.addKnownHost.and.rejectWith(new Error('disk full'));
    service.ensureListening();
    const cb = electron.onHostKeyPrompt.calls.first().args[0] as (r: never) => void;
    cb(prompt() as never);
    closeFns[0]('save');
    await tick();
    expect(notification.error).toHaveBeenCalled();
    expect(hooks.abort).toHaveBeenCalled();
    expect(hooks.retry).not.toHaveBeenCalled();
  });
});
