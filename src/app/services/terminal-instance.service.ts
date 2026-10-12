import {Injectable} from '@angular/core';
import {Subject} from 'rxjs';
import {Terminal} from '@xterm/xterm';

@Injectable({
  providedIn: 'root'
})
export class TerminalInstanceService {
  private instances = new Map<string, Terminal>();

  /** Emitted when the user asks to open terminal search (Ctrl+Shift+F). */
  private searchRequestSubject = new Subject<void>();
  searchRequest$ = this.searchRequestSubject.asObservable();

  register(id: string, terminal: Terminal) {
    this.instances.set(id, terminal);
  }

  unregister(id: string) {
    this.instances.delete(id);
  }

  requestSearch() {
    this.searchRequestSubject.next();
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
