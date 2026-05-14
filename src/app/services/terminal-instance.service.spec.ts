import {TerminalInstanceService} from './terminal-instance.service';

describe('TerminalInstanceService', () => {
  let service: TerminalInstanceService;

  beforeEach(() => {
    service = new TerminalInstanceService();
  });

  it('should start with no instances', () => {
    expect(service['instances'].size).toBe(0);
  });

  it('should register a terminal instance', () => {
    const terminal = {} as any;
    service.register('term-1', terminal);

    expect(service['instances'].size).toBe(1);
    expect(service['instances'].get('term-1')).toBe(terminal);
  });

  it('should overwrite an existing terminal on re-register', () => {
    const oldTerminal = {} as any;
    const newTerminal = {} as any;
    service.register('term-1', oldTerminal);
    service.register('term-1', newTerminal);

    expect(service['instances'].size).toBe(1);
    expect(service['instances'].get('term-1')).toBe(newTerminal);
  });

  it('should unregister a terminal instance', () => {
    const terminal = {} as any;
    service.register('term-1', terminal);
    service.unregister('term-1');

    expect(service['instances'].size).toBe(0);
  });

  it('should do nothing when unregistering a non-existent id', () => {
    service.register('term-1', {} as any);
    service.unregister('nonexistent');

    expect(service['instances'].size).toBe(1);
  });

  it('should register multiple terminals', () => {
    service.register('term-1', {} as any);
    service.register('term-2', {} as any);
    service.register('term-3', {} as any);

    expect(service['instances'].size).toBe(3);
  });

  describe('getTerminalContent', () => {
    function createMockLine(text: string): any {
      return { translateToString: () => text };
    }

    function createMockTerminal(lines: string[]): any {
      return {
        buffer: {
          active: {
            get length() { return lines.length; },
            getLine: (i: number) => lines[i] !== undefined ? createMockLine(lines[i]) : undefined,
          }
        }
      };
    }

    it('should return empty string when terminal is not registered', () => {
      expect(service.getTerminalContent('nonexistent')).toBe('');
    });

    it('should return concatenated content from a single line', () => {
      const term = createMockTerminal(['hello world']);
      service.register('term-1', term);

      expect(service.getTerminalContent('term-1')).toBe('hello world\n');
    });

    it('should return concatenated content from multiple lines', () => {
      const term = createMockTerminal(['line 1', 'line 2', 'line 3']);
      service.register('term-1', term);

      expect(service.getTerminalContent('term-1')).toBe('line 1\nline 2\nline 3\n');
    });

    it('should handle lines that return undefined from getLine', () => {
      const term = {
        buffer: {
          active: {
            get length() { return 3; },
            getLine: (i: number) => i === 1 ? undefined : { translateToString: () => `line ${i + 1}` },
          }
        }
      } as any;
      service.register('term-1', term);

      expect(service.getTerminalContent('term-1')).toBe('line 1\nline 3\n');
    });

    it('should return empty string for empty buffer', () => {
      const term = createMockTerminal([]);
      service.register('term-1', term);

      expect(service.getTerminalContent('term-1')).toBe('');
    });
  });
});
