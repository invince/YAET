import {Proxies, Proxy} from './Proxy';

describe('Proxy', () => {
  it('should create with default values', () => {
    const proxy = new Proxy();
    expect(proxy.id).toBeTruthy();
    expect(proxy.name).toBe('New Proxy');
    expect(proxy.type).toBe('HTTP');
    expect(proxy.host).toBe('');
    expect(proxy.port).toBe(8080);
    expect(proxy.isNew).toBeTrue();
  });

  it('should allow setting properties', () => {
    const proxy = new Proxy();
    proxy.name = 'Corporate Proxy';
    proxy.type = 'SOCKS5';
    proxy.host = 'proxy.example.com';
    proxy.port = 1080;
    expect(proxy.name).toBe('Corporate Proxy');
    expect(proxy.type).toBe('SOCKS5');
    expect(proxy.host).toBe('proxy.example.com');
    expect(proxy.port).toBe(1080);
  });

  it('should allow optional secretId', () => {
    const proxy = new Proxy();
    expect(proxy.secretId).toBeUndefined();
    proxy.secretId = 'secret-123';
    expect(proxy.secretId).toBe('secret-123');
  });
});

describe('Proxies', () => {
  it('should create with empty proxies array', () => {
    const list = new Proxies();
    expect(list.proxies).toEqual([]);
    expect(list.revision).toBeTruthy();
    expect(list.version).toBe('');
    expect(list.compatibleVersion).toBe('');
  });
});
