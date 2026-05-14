import {SettingStorageService} from './setting-storage.service';

describe('SettingStorageService', () => {
  let service: SettingStorageService;

  beforeEach(() => {
    service = new SettingStorageService();
  });

  it('should lazy-initialize MySettings on first get', () => {
    const settings = service.settings;
    expect(settings).toBeTruthy();
    expect(settings.ai).toBeTruthy();
    expect(settings.terminal).toBeTruthy();
  });

  it('should return the same instance on repeated get', () => {
    const first = service.settings;
    const second = service.settings;
    expect(first).toBe(second);
  });

  it('should store the value set via setter', () => {
    const mockSettings = { ai: null, terminal: null } as any;
    service.settings = mockSettings;
    expect(service.settings).toBe(mockSettings);
  });

  it('should return newly set value instead of lazy init', () => {
    const custom = { version: '2.0.0' } as any;
    service.settings = custom;
    expect(service.settings.version).toBe('2.0.0');
  });
});
