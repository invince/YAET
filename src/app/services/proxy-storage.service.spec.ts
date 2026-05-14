import {ProxyStorageService} from './proxy-storage.service';

describe('ProxyStorageService', () => {
  let service: ProxyStorageService;

  beforeEach(() => {
    service = new ProxyStorageService();
  });

  it('should start with a Proxies instance', () => {
    expect(service.data).toBeTruthy();
    expect(service.data.proxies).toEqual([]);
  });

  it('should store and retrieve data', () => {
    const mockProxy = { id: 'p1', name: 'My Proxy', host: 'proxy.example.com', port: 8080 };
    service.data.proxies = [mockProxy as any];
    expect(service.data.proxies.length).toBe(1);
    expect(service.data.proxies[0].name).toBe('My Proxy');
  });

  describe('dataCopy', () => {
    it('should return a deep copy via JSON serialization', () => {
      service.data.proxies = [{ id: 'p1', name: 'Proxy 1' } as any];
      const copy = service.dataCopy;
      expect(copy).not.toBe(service.data);
      expect(copy.proxies.length).toBe(1);
      expect(copy.proxies[0].name).toBe('Proxy 1');
    });

    it('should not affect original when modifying the copy', () => {
      service.data.proxies = [{ id: 'p1', name: 'Original' } as any];
      const copy = service.dataCopy;
      copy.proxies[0].name = 'Modified';
      expect(service.data.proxies[0].name).toBe('Original');
    });

    it('should handle empty proxies array', () => {
      const copy = service.dataCopy;
      expect(copy.proxies).toEqual([]);
    });
  });
});
