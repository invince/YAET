import {TunnelApprovalService} from './tunnel-approval.service';

describe('TunnelApprovalService (FIFO approval queue)', () => {
  let service: TunnelApprovalService;
  let electron: {
    onTunnelApprovalRequest: jasmine.Spy;
    resolveTunnelApproval: jasmine.Spy;
  };
  let opened: { data: { requestId?: string } | null }[];
  let closeFns: ((choice: 'deny' | 'once' | 'trust' | undefined) => void)[];

  beforeEach(() => {
    opened = [];
    closeFns = [];
    electron = {
      onTunnelApprovalRequest: jasmine.createSpy('onTunnelApprovalRequest'),
      resolveTunnelApproval: jasmine.createSpy('resolveTunnelApproval'),
    };
    const dialog = {
      open: jasmine.createSpy('open').and.callFake((_comp: unknown, config: { data: { requestId?: string } }) => {
        opened.push(config);
        return {
          afterClosed: () => ({
            subscribe: (fn: (choice: 'deny' | 'once' | 'trust' | undefined) => void) => {
              closeFns.push(fn);
            },
          }),
        };
      }),
    };
    service = new TunnelApprovalService(
      electron as never,
      dialog as never,
      { run: (fn: () => void) => fn() } as never,
      { warn: (_msg: string) => {} } as never,
    );
  });

  function request(id: string) {
    return { requestId: id, tunnelId: 't1', tunnelName: 'n', srcIP: '1.2.3.4', srcPort: 5, dstPort: 6 };
  }

  it('ensureListening subscribes once', () => {
    service.ensureListening();
    service.ensureListening();
    expect(electron.onTunnelApprovalRequest).toHaveBeenCalledTimes(1);
  });

  it('opens one dialog at a time and resolves in FIFO order', () => {
    service.ensureListening();
    const cb = electron.onTunnelApprovalRequest.calls.first().args[0] as (r: never) => void;
    cb(request('a') as never);
    cb(request('b') as never);
    expect(opened.length).toBe(1);

    closeFns[0]('once');
    expect(electron.resolveTunnelApproval).toHaveBeenCalledWith('a', true, false);
    expect(opened.length).toBe(2);

    closeFns[1]('deny');
    expect(electron.resolveTunnelApproval).toHaveBeenCalledWith('b', false, false);
  });

  it('trust choice forwards trustSource', () => {
    service.ensureListening();
    const cb = electron.onTunnelApprovalRequest.calls.first().args[0] as (r: never) => void;
    cb(request('a') as never);
    closeFns[0]('trust');
    expect(electron.resolveTunnelApproval).toHaveBeenCalledWith('a', true, true);
  });

  it('ignores malformed requests', () => {
    service.ensureListening();
    const cb = electron.onTunnelApprovalRequest.calls.first().args[0] as (r: never) => void;
    cb({} as never);
    cb(null as never);
    expect(opened.length).toBe(0);
  });

  it('dismissed dialogs count as deny without trust', () => {
    service.ensureListening();
    const cb = electron.onTunnelApprovalRequest.calls.first().args[0] as (r: never) => void;
    cb(request('a') as never);
    closeFns[0](undefined);
    expect(electron.resolveTunnelApproval).toHaveBeenCalledWith('a', false, false);
  });
});
