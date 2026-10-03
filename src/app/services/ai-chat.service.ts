import {Injectable} from '@angular/core';
import {BehaviorSubject, Subject} from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class AiChatService {
  private isOpenSubject = new BehaviorSubject<boolean>(false);
  isOpen$ = this.isOpenSubject.asObservable();

  toggle() {
    this.isOpenSubject.next(!this.isOpenSubject.value);
  }

  open() {
    this.isOpenSubject.next(true);
  }

  close() {
    this.isOpenSubject.next(false);
  }

  get isOpen() {
    return this.isOpenSubject.value;
  }

  // True while any chat run is in flight (streaming / tools / ACP).
  // Survives panel close — close hides, Stop settles. The toolbar uses it
  // for the "AI is working in the background" indicator.
  private runningSubject = new BehaviorSubject<boolean>(false);
  running$ = this.runningSubject.asObservable();

  setRunning(v: boolean) {
    if (this.runningSubject.value !== v) this.runningSubject.next(v);
  }

  get isRunning() {
    return this.runningSubject.value;
  }

  private focusSubject = new Subject<void>();
  focusRequested$ = this.focusSubject.asObservable();

  /** Open the panel (if closed) and ask it to focus its input. */
  requestFocus() {
    if (!this.isOpenSubject.value) this.isOpenSubject.next(true);
    this.focusSubject.next();
  }
}
