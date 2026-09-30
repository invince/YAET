import {CommonModule} from '@angular/common';
import {
  AfterViewChecked,
  ChangeDetectorRef,
  Component,
  ElementRef,
  HostListener,
  OnInit,
  ViewChild
} from '@angular/core';
import {FormsModule} from '@angular/forms';
import {MatButtonModule} from '@angular/material/button';
import {MatIconModule} from '@angular/material/icon';
import {MatProgressSpinnerModule} from '@angular/material/progress-spinner';
import {MatSlideToggleModule} from '@angular/material/slide-toggle';
import {DomSanitizer, SafeHtml} from '@angular/platform-browser';
import {firstValueFrom, Subscription} from 'rxjs';
import DOMPurify from 'dompurify';
import {marked} from 'marked';
import {AiChatHistoryService} from '../../services/ai-chat-history.service';
import {AiChatService} from '../../services/ai-chat.service';
import {AiService} from '../../services/ai.service';
import {ElectronTerminalService} from '../../services/electron/electron-terminal.service';
import {SettingStorageService} from '../../services/setting-storage.service';
import {TabService} from '../../services/tab.service';
import {TerminalInstanceService} from '../../services/terminal-instance.service';
import {ElectronService} from '../../services/electron/electron.service';
import {SettingService} from '../../services/setting.service';
import {NotificationService} from '../../services/notification.service';
import {RedactPipe} from '../../pipes/redact.pipe';

export interface ToolProgressEntry {
  toolName: string;
  args: any;
  result?: any;
  error?: string;
  ts: number;
  expanded: boolean;
}

export interface ChatMessage {
  role: string;
  content: string;
  /** client-side timestamp; absent on sessions saved before it existed */
  ts?: number;
}

// P1-2: bounded terminal tail for pure-chat/ACP modes (agent mode is fed by
// the backend incrementally instead). Last 100 lines + 6000 chars cap.
export function truncateTail(s: string): string {
  const lines = String(s || '').split('\n').slice(-100).join('\n');
  return lines.length > 6000 ? lines.slice(-6000) : lines;
}

// P2-1: progress entries dedupe on tool+args (args arrive as fresh objects
// per event, so === never matched and every event appended a new row).
export function progressKey(t: { toolName: string; args: any }): string {
  let a = '';
  try {
    a = JSON.stringify(t.args ?? null);
  } catch (_) {
    a = String(t.args);
  }
  return `${t.toolName}|${a}`;
}

@Component({
  selector: 'app-ai-chat',
  templateUrl: './ai-chat.component.html',
  styleUrls: ['./ai-chat.component.scss'],
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatSlideToggleModule,
    RedactPipe
  ]
})
export class AiChatComponent implements OnInit, AfterViewChecked {
  @ViewChild('scrollMe') private myScrollContainer!: ElementRef;
  @ViewChild('chatBox') private chatBox?: ElementRef<HTMLTextAreaElement>;
  isOpen = false;
  userInput = '';
  messages: ChatMessage[] = [];
  isLoading = false;
  toolProgress: ToolProgressEntry[] = [];
  pendingCommand: { requestId: string; toolName: string; args: any; preview: string } | null = null;
  private currentSubscription: Subscription | null = null;
  private _requestGeneration = 0;
  // P1-5: last ACP (command, args, model) triple — a change means the old
  // backend process must be closed before a new one is opened.
  private lastAcpTriple: { command: string; args: string; model: string } | null = null;
  showHistoryDropdown = false;
  renamingId: string | null = null;
  renameInput = '';
  /** index of the message whose copy feedback ("done") is showing */
  copiedIndex: number | null = null;
  private copyResetTimer: any = null;
  /** show the floating "jump to latest" button when scrolled up */
  showScrollButton = false;

  position: { x: number; y: number } | null = null;
  size = { w: 480, h: 620 };
  private dragOffset = { x: 0, y: 0 };
  isDragging = false;
  private dragPotential = false;
  private dragStartPos = { x: 0, y: 0 };
  private resizeStart = { x: 0, y: 0 };
  private resizeStartSize = { w: 480, h: 620 };
  private isResizing = false;
  private resizeDirection: 'se' | 'nw' = 'se';

  get useContext() {
    return this.settingStorage.settings.ai.useContext ?? true;
  }
  set useContext(val: boolean) {
    this.settingStorage.settings.ai.useContext = val;
    this.saveSettings();
  }

  get agentMode() {
    return this.settingStorage.settings.ai.agentMode ?? false;
  }
  set agentMode(val: boolean) {
    this.settingStorage.settings.ai.agentMode = val;
    this.saveSettings();
  }

  get currentSessionName() {
    return this.historyService.current?.name ?? 'AI Assistant';
  }

  get sessions() {
    return this.historyService.list;
  }

  get currentSessionId() {
    return this.historyService.currentSessionId;
  }

  /** compact "agent · gpt-4o" style label for the header status line */
  get modelLabel(): string {
    const ai = this.settingStorage.settings.ai as any;
    if (!ai) return '';
    const mode = ai.mode || (ai.acpCommand ? 'acp' : 'web');
    if (mode === 'acp') {
      const cmd = String(ai.acpCommand || '').split('/').pop() || 'acp';
      return `acp · ${cmd}${ai.acpModel ? ' · ' + ai.acpModel : ''}`;
    }
    const parts = [this.agentMode ? 'agent' : 'chat'];
    if (ai.model) parts.push(String(ai.model).split('/').pop()!);
    return parts.join(' · ');
  }

  /** greeting used for brand-new / cleared chats */
  private greeting(): ChatMessage {
    return { role: 'assistant', content: 'Hello! How can I help you today?', ts: Date.now() };
  }

  private pushMessage(msg: ChatMessage) {
    if (msg.ts == null) msg.ts = Date.now();
    this.messages.push(msg);
  }

  formatTime(ts?: number): string {
    if (!ts) return '';
    try {
      return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch { return ''; }
  }

  @HostListener('document:click')
  onDocClick() {
    this.showHistoryDropdown = false;
  }

  constructor(
    private aiService: AiService,
    private settingStorage: SettingStorageService,
    private tabService: TabService,
    private terminalInstanceService: TerminalInstanceService,
    private electronTerminalService: ElectronTerminalService,
    public aiChatService: AiChatService,
    private electronService: ElectronService,
    private settingService: SettingService,
    private cdr: ChangeDetectorRef,
    private sanitizer: DomSanitizer,
    private historyService: AiChatHistoryService,
    private notificationService: NotificationService,
    private el: ElementRef
  ) { }

  ngOnInit(): void {
    this.loadState();
    const current = this.historyService.current;
    if (current) {
      this.messages = [...current.messages];
    }
  }

  ngAfterViewChecked() {
    this.scrollToBottom();
  }

  private isNearBottom(): boolean {
    const el = this.myScrollContainer.nativeElement;
    const threshold = 30;
    return el.scrollHeight - el.scrollTop - el.clientHeight < threshold;
  }

  scrollToBottom(): void {
    try {
      if (this.isNearBottom()) {
        this.myScrollContainer.nativeElement.scrollTop = this.myScrollContainer.nativeElement.scrollHeight;
      }
    } catch (err) { }
  }

  /** jump to the newest message regardless of "near bottom" heuristic */
  jumpToLatest(): void {
    try {
      const el = this.myScrollContainer.nativeElement;
      el.scrollTop = el.scrollHeight;
      this.showScrollButton = false;
    } catch { }
  }

  onMessagesScroll(): void {
    // Fires for user drags AND programmatic scrollTop changes — the only
    // place showScrollButton may be mutated (afterViewChecked would risk
    // ExpressionChangedAfterItHasBeenCheckedError in dev mode).
    try {
      const el = this.myScrollContainer.nativeElement;
      const dist = el.scrollHeight - el.scrollTop - el.clientHeight;
      this.showScrollButton = dist > 120;
      if (dist < 40) this.showScrollButton = false;
    } catch { }
  }

  private markdownCache = new Map<string, SafeHtml>();

  parseMarkdown(content: string): SafeHtml {
    if (!content) return '';
    const cached = this.markdownCache.get(content);
    if (cached) return cached;
    try {
      let rawHtml = marked.parse(content) as string;
      rawHtml = rawHtml.replace(/<pre>/g, '<div class="code-block"><button class="code-copy-btn" type="button" aria-label="Copy code">copy</button><pre>');
      rawHtml = rawHtml.replace(/<\/pre>/g, '</pre></div>');
      // Forbid javascript:/data: links even though clicks are intercepted —
      // innerHTML still exposes them to context-menu / drag-out.
      const cleanHtml = DOMPurify.sanitize(rawHtml, {
        ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto|tel|ftp):|[^a-z]|[a-z+.-]+(?:[^a-z+.\-:]|$))/i,
      });
      const safe = this.sanitizer.bypassSecurityTrustHtml(cleanHtml);
      // Cap cache: keys are full message bodies, unbounded growth = leak
      // on long sessions. Evict oldest (Map preserves insertion order).
      if (this.markdownCache.size >= 200) {
        const oldest = this.markdownCache.keys().next().value;
        if (oldest !== undefined) this.markdownCache.delete(oldest);
      }
      this.markdownCache.set(content, safe);
      return safe;
    } catch (e) {
      return content as any;
    }
  }

  toggleChat() {
    if (this.aiChatService.isOpen) {
      this.clearToolProgress();
    }
    this.aiChatService.toggle();
  }

  toggleHistoryDropdown(event: MouseEvent) {
    event.stopPropagation();
    this.showHistoryDropdown = !this.showHistoryDropdown;
  }

  stopProp(event: MouseEvent) {
    event.stopPropagation();
  }

  private saveMessages() {
    this.historyService.saveCurrentMessages(this.messages);
  }

  newChat() {
    this.clearToolProgress();
    this.saveMessages();
    this.historyService.createNew();
    // P2-2: trimming used to silently discard old chats — say so.
    const dropped = this.historyService.lastTrimmedCount;
    this.historyService.lastTrimmedCount = 0;
    if (dropped > 0) {
      this.notificationService.info(`Removed ${dropped} oldest chat(s) — history keeps 10`);
    }
    this.messages = [...(this.historyService.current?.messages ?? [])];
    this.showHistoryDropdown = false;
    this.cdr.detectChanges();
  }

  switchSession(id: string) {
    this.clearToolProgress();
    this.saveMessages();
    this.historyService.switchTo(id);
    this.messages = [...(this.historyService.current?.messages ?? [])];
    this.showHistoryDropdown = false;
    this.cdr.detectChanges();
  }

  deleteSession(id: string) {
    this.historyService.remove(id);
    this.messages = [...(this.historyService.current?.messages ?? [])];
    this.showHistoryDropdown = false;
    this.cdr.detectChanges();
  }

  startRename(id: string, currentName: string) {
    this.renamingId = id;
    this.renameInput = currentName;
    setTimeout(() => {
      const input = document.querySelector('.rename-input') as HTMLInputElement;
      if (input) { input.focus(); input.select(); }
    });
  }

  confirmRename() {
    if (this.renamingId && this.renameInput.trim()) {
      this.historyService.renameSession(this.renamingId, this.renameInput.trim());
      this.cdr.detectChanges();
    }
    this.renamingId = null;
    this.renameInput = '';
  }

  cancelRename() {
    this.renamingId = null;
    this.renameInput = '';
  }

  onHeaderMouseDown(event: MouseEvent) {
    if (!this.aiChatService.isOpen) return;
    const target = event.target as HTMLElement;
    if (target.closest('.header-right') || target.closest('.close-btn') || target.closest('.history-dropdown')) {
      return;
    }
    this.dragPotential = true;
    this.dragStartPos = { x: event.clientX, y: event.clientY };
    const container = this.el.nativeElement.querySelector('.chat-container') as HTMLElement;
    const rect = container.getBoundingClientRect();
    if (!this.position) {
      this.position = { x: rect.left, y: rect.top };
    }
    this.dragOffset = { x: event.clientX - this.position.x, y: event.clientY - this.position.y };
  }

  onResizeMouseDown(event: MouseEvent, direction: 'se' | 'nw') {
    event.preventDefault();
    event.stopPropagation();
    this.resizeDirection = direction;
    this.isResizing = true;
    this.resizeStart = { x: event.clientX, y: event.clientY };
    this.resizeStartSize = { ...this.size };
  }

  @HostListener('document:mousemove', ['$event'])
  onDocMouseMove(event: MouseEvent) {
    if (this.dragPotential) {
      const dx = Math.abs(event.clientX - this.dragStartPos.x);
      const dy = Math.abs(event.clientY - this.dragStartPos.y);
      if (dx > 3 || dy > 3) {
        this.dragPotential = false;
        this.isDragging = true;
      }
    }
    if (this.isDragging && this.position) {
      this.position = {
        x: event.clientX - this.dragOffset.x,
        y: event.clientY - this.dragOffset.y,
      };
    }
    if (this.isResizing) {
      const dx = this.resizeDirection === 'se'
        ? event.clientX - this.resizeStart.x
        : this.resizeStart.x - event.clientX;
      const dy = this.resizeDirection === 'se'
        ? event.clientY - this.resizeStart.y
        : this.resizeStart.y - event.clientY;
      this.size = {
        w: Math.max(320, Math.min(1000, this.resizeStartSize.w + dx)),
        h: Math.max(300, Math.min(1200, this.resizeStartSize.h + dy)),
      };
    }
  }

  @HostListener('document:mouseup')
  onDocMouseUp() {
    this.dragPotential = false;
    if (this.isDragging) {
      this.isDragging = false;
      this.saveState();
    }
    if (this.isResizing) {
      this.isResizing = false;
      this.saveState();
    }
  }

  @HostListener('click', ['$event'])
  onMessageClick(event: MouseEvent) {
    const btn = (event.target as HTMLElement).closest('.code-copy-btn');
    if (btn) {
      const pre = btn.parentElement?.querySelector('pre');
      if (!pre) return;
      navigator.clipboard.writeText(pre.textContent || '').catch(() => {});
      btn.textContent = 'done';
      setTimeout(() => { btn.textContent = 'copy'; }, 2000);
      return;
    }

    const anchor = (event.target as HTMLElement).closest('a');
    if (anchor?.href) {
      event.preventDefault();
      this.electronService.openUrl(anchor.href);
    }
  }

  @HostListener('window:resize')
  onWindowResize() {
    if (this.position) {
      this.position.x = Math.max(0, Math.min(this.position.x, window.innerWidth - this.size.w));
      this.position.y = Math.max(0, Math.min(this.position.y, window.innerHeight - this.size.h));
    }
  }

  private loadState() {
    try {
      const pos = localStorage.getItem('ai-chat-pos');
      const size = localStorage.getItem('ai-chat-size');
      if (pos) this.position = JSON.parse(pos);
      if (size) this.size = JSON.parse(size);
      // Migrate the pre-lift default footprint (420x500) to the roomier
      // one — users who never resized shouldn't be stuck on the tiny box.
      if (this.size.w === 420 && this.size.h === 500) {
        this.size = { w: 480, h: 620 };
        localStorage.setItem('ai-chat-size', JSON.stringify(this.size));
      }
      // Clamp anything out of range (hand-edited / window shrank).
      this.size = {
        w: Math.max(320, Math.min(1000, this.size.w || 480)),
        h: Math.max(300, Math.min(1200, this.size.h || 620)),
      };
    } catch { }
  }

  private saveState() {
    try {
      if (this.position) localStorage.setItem('ai-chat-pos', JSON.stringify(this.position));
      localStorage.setItem('ai-chat-size', JSON.stringify(this.size));
    } catch { }
  }

  private async autoRenameSession() {
    const session = this.historyService.current;
    if (!session || session.name !== 'New Chat') return;

    const aiSettings = this.settingStorage.settings.ai;
    if (!aiSettings || !aiSettings.mode) return;

    const msgs = session.messages;
    const userMsg = msgs.find(m => m.role === 'user');
    const assistantMsg = msgs.find(m => m.role === 'assistant' && m !== msgs[0]);
    if (!userMsg || !assistantMsg) return;

    // P1-2: title comes from the opening exchange; cap it so long chats
    // don't pay a full-history read for a 3-word title.
    const renamePayload = [
      { role: 'system', content: 'Generate a short title (2-5 words) for this conversation. Respond with ONLY the title, nothing else.' },
      ...msgs.slice(0, 4).map(m => ({ role: m.role, content: String(m.content || '').slice(0, 500) }))
    ];

    try {
      let title = '';
      const mode = aiSettings.mode || 'web';
      if (mode === 'acp') {
        const resp = await this.aiService.sendAcpMessage(
          aiSettings.acpCommand, aiSettings.acpArgs, aiSettings.acpModel, renamePayload
        );
        title = this.aiService.extractAcpContent(resp);
      } else {
        const resp = await firstValueFrom(this.aiService.sendWebMessage(
          aiSettings.apiUrl, aiSettings.token, aiSettings.model, renamePayload, session.id
        ));
        title = this.aiService.extractWebContent(resp);
      }
      if (title) {
        title = title.replace(/["""''"]/g, '').trim();
        this.historyService.renameSession(session.id, title);
        this.cdr.detectChanges();
      }
    } catch (e) {
      console.error('Auto-rename failed:', e);
    }
  }

  sendMessage() {
    if (!this.userInput.trim() || this.isLoading) return;

    const aiSettings = this.settingStorage.settings.ai;
    if (!aiSettings) {
      this.pushMessage({ role: 'assistant', content: 'Please configure AI settings in the Settings menu first.' });
      this.userInput = '';
      this.resetChatBoxHeight();
      return;
    }

    const mode = aiSettings.mode || (aiSettings.acpCommand ? 'acp' : 'web');
    aiSettings.mode = mode;

    if (mode === 'web' && !aiSettings.token) {
      this.pushMessage({ role: 'assistant', content: 'Please configure a valid API token in the Settings menu first.' });
      this.userInput = '';
      this.resetChatBoxHeight();
      return;
    }

    if (mode === 'acp' && !aiSettings.acpCommand) {
      this.pushMessage({ role: 'assistant', content: 'Please configure the ACP command in the Settings menu first.' });
      this.userInput = '';
      this.resetChatBoxHeight();
      return;
    }

    const userMessage = this.userInput;
    this.pushMessage({ role: 'user', content: `${userMessage}` });
    this.userInput = '';
    this.resetChatBoxHeight();
    this.saveMessages();
    // Reset BEFORE flipping isLoading — clearToolProgress() itself sets
    // isLoading=false (it also runs on switch/new-chat), so ordering it
    // after made the loading state vanish instantly (no typing dots, no
    // Stop button, input stayed editable mid-run).
    this.clearToolProgress();
    this.isLoading = true;
    // Sending always snaps to the newest message (user may be scrolled up).
    this.jumpToLatest();

    const activeTab = this.tabService.getSelectedTab();
    let context = '';
    if (this.useContext) {
      if (activeTab && activeTab.category === 'TERMINAL') {
        context = this.terminalInstanceService.getTerminalContent(activeTab.id);
      }
    }

    // P1-2: context is injected exactly once per mode, never twice.
    // - agent mode: backend injects AI sessions + active tab incrementally
    //   (aiChat.js injectSessionContext) — push nothing here.
    // - pure-chat/ACP: backend injects nothing — push a BOUNDED tail here.
    const isAgent = this.agentMode && mode === 'web';
    // Cap outbound history: full unbounded history blows token budget and
    // latency on long chats. Keep the opening exchange (index 0 greeting)
    // for rename continuity + last 20 messages.
    const historySlice = this.messages.length > 22
      ? [this.messages[0], ...this.messages.slice(-20)]
      : [...this.messages];
    const payload = historySlice;
    if (context && !isAgent) {
        payload.push({ role: 'user', content: `Current terminal context (tail):\n${truncateTail(context)}` });
    }

    if (isAgent) {
      this.sendWebMessageWithTools(aiSettings, payload, activeTab);
    } else if (mode === 'acp') {
      this.sendAcpMessage(aiSettings, payload, activeTab);
    } else {
      this.sendWebMessage(aiSettings, payload, activeTab);
    }
  }

  private sendWebMessage(aiSettings: any, payload: any[], activeTab: any) {
    const gen = this._requestGeneration;
    this.currentSubscription?.unsubscribe();
    this.currentSubscription = null;
    // Streaming placeholder: chunks append here live, so the answer renders
    // word-by-word instead of popping in whole at the end.
    const assistantMessage: ChatMessage = { role: 'assistant', content: '', ts: Date.now() };
    this.messages.push(assistantMessage);
    this.cdr.detectChanges();
    this.scrollToBottom();

    // Re-parsing full markdown on every token is O(n^2) on long answers —
    // flush DOM updates at most every ~80ms (final flush on done).
    let lastFlush = 0;
    const flush = () => {
      lastFlush = Date.now();
      this.cdr.detectChanges();
      this.scrollToBottom();
    };
    const appendChunk = (text: string) => {
      if (!text) return;
      assistantMessage.content += text;
      if (Date.now() - lastFlush >= 80) flush();
    };

    this.electronService.removeWebChunkListeners();
    this.electronService.onWebChunk((data: any) => {
      if (gen !== this._requestGeneration) return;
      if (data.done) {
        if (typeof data.full === 'string') assistantMessage.content = data.full;
        this.electronService.removeWebChunkListeners();
        flush();
        if (!assistantMessage.content) {
          // Empty stream = same as empty reply before: no bubble at all.
          this.messages = this.messages.filter(m => m !== assistantMessage);
          this.cdr.detectChanges();
          this.isLoading = false;
          return;
        }
        this.handleResponse(assistantMessage.content, activeTab);
        return;
      }
      if (typeof data.full === 'string') {
        assistantMessage.content = data.full;
        if (Date.now() - lastFlush >= 80) flush();
      } else if (typeof data.chunk === 'string') {
        appendChunk(data.chunk);
      }
    });

    this.aiService.sendWebMessageStream(
      aiSettings.apiUrl,
      aiSettings.token,
      aiSettings.model,
      payload,
      this.currentSessionId
    ).then(
      () => {
        // Normal path finalizes via the {done} chunk event above; this is
        // only a backstop in case the event was missed.
        if (gen !== this._requestGeneration || !this.isLoading) return;
        this.electronService.removeWebChunkListeners();
        flush();
        this.handleResponse(assistantMessage.content, activeTab);
      },
      (err) => {
        if (gen !== this._requestGeneration) return;
        this.electronService.removeWebChunkListeners();
        // P1-1: user-cancelled runs are silent — no error bubble.
        const msg = (err as any)?.message || String(err || '');
        if (/cancelled by user/i.test(msg)) {
          this.isLoading = false;
          this.saveMessages();
          this.cdr.detectChanges();
          return;
        }
        console.error(err);
        if (assistantMessage.content) {
          // Mid-stream failure: keep what arrived, finalize as the answer.
          flush();
          this.handleResponse(assistantMessage.content, activeTab);
          return;
        }
        // Failed before any content: drop the empty placeholder, same UX as
        // the old non-streaming error path.
        this.messages = this.messages.filter(m => m !== assistantMessage);
        this.pushMessage({ role: 'assistant', content: 'Error communicating with AI. Please check your configuration.' });
        this.isLoading = false;
      }
    );
  }

  private sendWebMessageWithTools(aiSettings: any, payload: any[], activeTab: any) {
    this.toolProgress = [];
    this.pendingCommand = null;
    this.electronService.removeToolProgressListeners();
    this.electronService.removeCommandPendingListeners();
    this.electronService.onCommandPending((data: any) => {
      console.log('[AI Chat] Command pending received:', data);
      this.pendingCommand = data;
      this.cdr.detectChanges();
    });
    this.electronService.onToolProgress((data: ToolProgressEntry) => {
      // P2-1: same tool+args updates the row in place instead of appending
      // a duplicate per event. Keep the user's expanded toggle.
      const existing = this.toolProgress.find(t => progressKey(t) === progressKey(data));
      if (existing) {
        const expanded = existing.expanded;
        Object.assign(existing, data);
        existing.expanded = expanded || !!data.error;
      } else {
        this.toolProgress.push({ ...data, expanded: !!data.error });
      }
      this.cdr.detectChanges();
      this.scrollToBottom();
    });

    const gen = this._requestGeneration;
    const useContext = aiSettings.useContext !== false;
    const chatSessionId = this.currentSessionId;
    // P1-2: backend injects the active tab incrementally; it needs the id.
    const activeTabId = useContext ? (activeTab?.id || null) : null;
    this.currentSubscription?.unsubscribe();
    this.currentSubscription = this.aiService.sendWithTools(
      aiSettings.apiUrl,
      aiSettings.token,
      aiSettings.model,
      payload,
      aiSettings.crossSessionAccess,
      useContext,
      chatSessionId,
      activeTabId
    ).subscribe({
      next: (resp) => {
        this.currentSubscription = null;
        if (gen !== this._requestGeneration) return;
        this.electronService.removeToolProgressListeners();
        this.electronService.removeCommandPendingListeners();
        this.pendingCommand = null;
        let aiResponse = this.aiService.extractWebContent(resp);
        this.handleResponse(aiResponse, activeTab);
      },
      error: (err) => {
        this.currentSubscription = null;
        if (gen !== this._requestGeneration) return;
        this.electronService.removeToolProgressListeners();
        this.electronService.removeCommandPendingListeners();
        this.pendingCommand = null;
        // P1-1: user-cancelled runs are silent — no error bubble.
        const msg = (err as any)?.message || String(err || '');
        if (/cancelled by user/i.test(msg)) {
          this.isLoading = false;
          this.cdr.detectChanges();
          return;
        }
        console.error(err);
        this.pushMessage({ role: 'assistant', content: 'Error communicating with AI. Please check your configuration.' });
        this.isLoading = false;
      }
    });
  }

  private async closeStaleAcpSession(aiSettings: any) {
    const triple = {
      command: aiSettings.acpCommand || '',
      args: aiSettings.acpArgs || '',
      model: aiSettings.acpModel || '',
    };
    const prev = this.lastAcpTriple;
    this.lastAcpTriple = triple;
    if (prev && (prev.command !== triple.command || prev.args !== triple.args || prev.model !== triple.model)) {
      await this.electronService.closeAcpSession(prev.command, prev.args, prev.model);
    }
  }

  private async sendAcpMessage(aiSettings: any, payload: any[], activeTab: any) {
    const gen = this._requestGeneration;
    // P1-5: triple changed (new model/command) → kill the stale backend
    // process before opening a new one, otherwise it lingers forever.
    await this.closeStaleAcpSession(aiSettings);
    let assistantMessage: ChatMessage = { role: 'assistant', content: '', ts: Date.now() };
    this.messages.push(assistantMessage);

    this.electronService.removeAcpChunkListeners();
    this.electronService.onAcpChunk((data: any) => {
      if (gen !== this._requestGeneration) return;
      if (data.done) {
          this.isLoading = false;
          this.cdr.detectChanges();
          return;
      }
      if (data.full) {
          assistantMessage.content = data.full;
          this.cdr.detectChanges();
          this.scrollToBottom();
          return;
      }
      if (data.chunk && !assistantMessage.content.endsWith(data.chunk)) {
          assistantMessage.content += data.chunk;
          this.cdr.detectChanges();
          this.scrollToBottom();
      }
    });

    try {
      const resp = await this.aiService.sendAcpMessage(
        aiSettings.acpCommand,
        aiSettings.acpArgs,
        aiSettings.acpModel,
        payload
      );

      if (gen !== this._requestGeneration) return;

      this.electronService.removeAcpChunkListeners();

      this.isLoading = false;
      this.cdr.detectChanges();

      if (!assistantMessage.content && resp) {
          assistantMessage.content = resp;
      }

      this.handleResponse(assistantMessage.content, activeTab);
    } catch (err) {
      if (gen !== this._requestGeneration) return;
      this.electronService.removeAcpChunkListeners();
      console.error(err);
      assistantMessage.content = 'Error communicating with AI. Please check your configuration.';
      this.isLoading = false;
      this.cdr.detectChanges();
    }
  }

  private handleResponse(aiResponse: string, activeTab: any) {
    this.isLoading = false;
    this.cdr.detectChanges();
    this.scrollToBottom();

    if (!aiResponse) return;

    const lastMsg = this.messages[this.messages.length - 1];
    if (!lastMsg || lastMsg.role !== 'assistant') {
      this.pushMessage({ role: 'assistant', content: aiResponse });
    }
    this.saveMessages();
    this.autoRenameSession();

    this.isLoading = false;
    this.cdr.detectChanges();
    this.scrollToBottom();
  }

  // UI: empty-state quick prompts (i18n-free, ops-oriented for a terminal app).
  readonly suggestions: string[] = [
    'Summarize the current terminal output',
    'Check disk usage on this machine',
    'Check system load and memory',
  ];

  sendSuggestion(text: string) {
    if (this.isLoading) return;
    this.userInput = text;
    this.resetChatBoxHeight();
    this.sendMessage();
  }

  // Enter 发送, Shift+Enter 换行.
  onInputKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.sendMessage();
    }
  }

  autoGrow(el: HTMLTextAreaElement) {
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 140) + 'px';
  }

  private resetChatBoxHeight() {
    try {
      const el = this.chatBox?.nativeElement;
      if (el) el.style.height = 'auto';
    } catch (_) {}
  }

  stop() {
    this._requestGeneration++;
    // P1-1: abort the backend run too (loop + HTTP + pending tools).
    // Opened ai_* sessions are kept. Also reject a pending approval prompt.
    this.electronService.cancelAiChat(this.currentSessionId);
    this.isLoading = false;
    this.currentSubscription?.unsubscribe();
    this.currentSubscription = null;
    this.electronService.removeAcpChunkListeners();
    this.electronService.removeToolProgressListeners();
    this.electronService.removeCommandPendingListeners();
    if (this.pendingCommand) {
      this.electronService.rejectCommand(this.pendingCommand.requestId);
    }
    this.pendingCommand = null;
    // Persist partial streamed content so stopping mid-answer doesn't lose it.
    this.saveMessages();
    this.cdr.detectChanges();
  }

  private clearToolProgress() {
    this._requestGeneration++;
    // P1-1: switching/new chat also aborts the previous backend run.
    this.electronService.cancelAiChat(this.currentSessionId);
    this.toolProgress = [];
    if (this.pendingCommand) {
      this.electronService.rejectCommand(this.pendingCommand.requestId);
      this.notificationService.info('Command rejected');
    }
    this.pendingCommand = null;
    this.isLoading = false;
    this.currentSubscription?.unsubscribe();
    this.currentSubscription = null;
    this.electronService.removeToolProgressListeners();
    this.electronService.removeCommandPendingListeners();
  }

  toggleToolEntry(entry: ToolProgressEntry) {
    entry.expanded = !entry.expanded;
  }

  approveCommand() {
    if (this.pendingCommand) {
      this.electronService.approveCommand(this.pendingCommand.requestId);
      this.pendingCommand = null;
      this.cdr.detectChanges();
    }
  }

  rejectCommand() {
    if (this.pendingCommand) {
      this.electronService.rejectCommand(this.pendingCommand.requestId);
      this.pendingCommand = null;
      this.cdr.detectChanges();
    }
  }

  // ── Message actions ────────────────────────────────────────────────
  copyMessage(index: number, event?: Event) {
    event?.stopPropagation();
    const msg = this.messages[index];
    if (!msg) return;
    navigator.clipboard.writeText(msg.content || '').then(() => {
      this.copiedIndex = index;
      if (this.copyResetTimer) clearTimeout(this.copyResetTimer);
      this.copyResetTimer = setTimeout(() => { this.copiedIndex = null; this.cdr.detectChanges(); }, 1500);
      this.cdr.detectChanges();
    }).catch(() => this.notificationService.info('Copy failed'));
  }

  /** Re-send a user message: drop it + every answer after it, resend. */
  retryFrom(index: number) {
    if (this.isLoading) return;
    const idx = index;
    if (idx < 0 || idx >= this.messages.length || this.messages[idx].role !== 'user') return;
    const text = (this.messages[idx].content || '').trim();
    if (!text) return;
    this.messages = this.messages.slice(0, idx);
    this.userInput = text;
    this.saveMessages();
    this.cdr.detectChanges();
    this.sendMessage();
  }

  /** Wipe the current conversation back to the greeting. */
  clearChat() {
    this.clearToolProgress();
    this.messages = [this.greeting()];
    this.saveMessages();
    this.showHistoryDropdown = false;
    this.notificationService.info('Conversation cleared');
    this.cdr.detectChanges();
  }

  /** Export current conversation as Markdown (download via data URL). */
  exportChat() {
    if (this.messages.length === 0) return;
    this.showHistoryDropdown = false;
    const name = this.currentSessionName || 'chat';
    const lines = this.messages.map(m => {
      const who = m.role === 'user' ? '**You**' : '**AI**';
      const when = m.ts ? ` · ${new Date(m.ts).toLocaleString()}` : '';
      return `### ${who}${when}\n\n${m.content || ''}\n`;
    });
    const header = `# ${name}\n\n_Exported ${new Date().toLocaleString()} · ${this.modelLabel}_\n\n`;
    try {
      const blob = new Blob([header + lines.join('\n---\n\n')], { type: 'text/markdown;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${name.replace(/[^\w\u4e00-\u9fa5-]+/g, '_').slice(0, 60) || 'chat'}.md`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    } catch (e) {
      this.notificationService.info('Export failed');
    }
  }

  private saveSettings() {
    this.settingService.save();
  }
}
