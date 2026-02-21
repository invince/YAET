import {Injectable} from '@angular/core';
import {Terminal} from '@xterm/xterm';

@Injectable({
  providedIn: 'root'
})
export class TerminalInstanceService {
  private instances = new Map<string, Terminal>();

  register(id: string, terminal: Terminal) {
    this.instances.set(id, terminal);
  }

  unregister(id: string) {
    this.instances.delete(id);
  }

  getTerminalContent(id: string): string {
    const term = this.instances.get(id);
    if (!term) return '';

    // Get all content from the buffer
    let content = '';
    const buffer = term.buffer.active;
    for (let i = 0; i < buffer.length; i++) {
        const line = buffer.getLine(i);
        if (line) {
            content += line.translateToString() + '\n';
        }
    }
    return content;
  }
}
