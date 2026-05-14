import {LogService} from './log.service';

describe('LogService', () => {
  let mockElectronService: any;
  let service: LogService;

  beforeEach(() => {
    mockElectronService = { log: jasmine.createSpy('log') };
    service = new LogService(mockElectronService);
  });

  it('should call electronService.log with info level', () => {
    service.info('test info');
    expect(mockElectronService.log).toHaveBeenCalledWith({ level: 'info', message: 'test info' });
  });

  it('should call electronService.log with debug level', () => {
    service.debug('test debug');
    expect(mockElectronService.log).toHaveBeenCalledWith({ level: 'debug', message: 'test debug' });
  });

  it('should call electronService.log with error level', () => {
    service.error('test error');
    expect(mockElectronService.log).toHaveBeenCalledWith({ level: 'error', message: 'test error' });
  });

  it('should call electronService.log with warn level', () => {
    service.warn('test warn');
    expect(mockElectronService.log).toHaveBeenCalledWith({ level: 'warn', message: 'test warn' });
  });

  it('should call electronService.log with trace level', () => {
    service.trace('test trace');
    expect(mockElectronService.log).toHaveBeenCalledWith({ level: 'trace', message: 'test trace' });
  });

  it('should call electronService.log with fatal level', () => {
    service.fatal('test fatal');
    expect(mockElectronService.log).toHaveBeenCalledWith({ level: 'fatal', message: 'test fatal' });
  });
});
