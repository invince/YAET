import {ElectronService} from './electron.service';

describe('ElectronService (tunnels + common IPC, fake window.electronAPI)', () => {
  let service: ElectronService;
  let ipc: {
    sent: { channel: string; data: unknown }[];
    invoked: { channel: string; data: unknown }[];
    listened: string[];
    send: jasmine.Spy; invoke: jasmine.Spy; on: jasmine.Spy; removeAllListeners: jasmine.Spy;
  };

  beforeEach(() => {
    ipc = {
      sent: [], invoked: [], listened: [],
      send: jasmine.createSpy('send').and.callFake((channel: string, data: unknown) => {
        ipc.sent.push({ channel, data });
      }),
      invoke: jasmine.createSpy('invoke').and.callFake(async (channel: string, data: unknown) => {
        ipc.invoked.push({ channel, data });
        if (channel === 'tunnels.list') return [{ tunnelId: 't1' }];
        if (channel === 'tunnels.start') return { tunnelId: 't1', status: 'active' };
        if (channel === 'tunnels.stop') return true;
        return undefined;
      }),
      on: jasmine.createSpy('on').and.callFake((channel: string) => {
        ipc.listened.push(channel);
      }),
      removeAllListeners: jasmine.createSpy('removeAllListeners'),
    };
    (window as unknown as { electronAPI: unknown }).electronAPI = ipc;
    service = new ElectronService({} as never, {} as never, {} as never);
  });

  afterEach(() => {
    delete (window as unknown as { electronAPI?: unknown }).electronAPI;
  });

  it('sends log and open-url through common channels', () => {
    service.log({ level: 'info', message: 'hi' } as never);
    service.openUrl('https://example.com');
    expect(ipc.sent.map(s => s.channel)).toEqual(['log', 'open-url']);
  });

  it('listTunnels returns the list, start/stop/stopAll round-trip', async () => {
    expect(await service.listTunnels()).toEqual([{ tunnelId: 't1' }]);
    expect(await service.startTunnel('t1')).toEqual({ tunnelId: 't1', status: 'active' });
    expect(await service.stopTunnel('t1')).toBeTrue();
    await service.stopAllTunnels();
    expect(ipc.invoked.map(s => s.channel)).toEqual([
      'tunnels.list', 'tunnels.start', 'tunnels.stop', 'tunnels.stop-all',
    ]);
    expect(ipc.invoked[1]).toEqual({ channel: 'tunnels.start', data: { tunnelId: 't1' } });
  });

  it('listTunnels tolerates non-array payloads', async () => {
    ipc.invoke.and.callFake(async () => 'oops');
    expect(await service.listTunnels()).toEqual([]);
  });

  it('status listener registration and removal', () => {
    service.onTunnelStatusChanged(() => {});
    expect(ipc.listened).toContain('tunnels.status-changed');
    service.removeTunnelStatusChangedListeners();
    expect(ipc.removeAllListeners).toHaveBeenCalledWith('tunnels.status-changed');
  });

  it('proxies save/reload use their channels', async () => {
    await service.saveProxies({} as never);
    service.reloadProxies();
    expect(ipc.sent.map(s => s.channel)).toEqual(['proxies.save', 'proxies.reload']);
  });

  it('cancelAiChat fire-and-forget with and without session id', () => {
    service.cancelAiChat(null);
    service.cancelAiChat('chat-1');
    const cancels = ipc.sent.filter(s => s.channel === 'ai.cancel-chat');
    expect(cancels.length).toBe(2);
    expect(cancels[1]).toEqual({ channel: 'ai.cancel-chat', data: { chatSessionId: 'chat-1' } });
  });
});
