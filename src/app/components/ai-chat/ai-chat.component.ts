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
import {MatFormFieldModule} from '@angular/material/form-field';
import {MatIconModule} from '@angular/material/icon';
import {MatInputModule} from '@angular/material/input';
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
import {RedactPipe} from '../../pipes/redact.pipe';

export interface ToolProgressEntry {
  toolName: string;
  args: any;
  result?: any;
  error?: string;
  ts: number;
  expanded: boolean;
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
    MatInputModule,
    MatFormFieldModule,
    MatProgressSpinnerModule,
    MatSlideToggleModule,
    RedactPipe
  ]
})
export class AiChatComponent implements OnInit, AfterViewChecked {
  @ViewChild('scrollMe') private myScrollContainer!: ElementRef;
  isOpen = false;
  userInput = '';
  messages: { role: string, content: string }[] = [];
  isLoading = false;
  toolProgress: ToolProgressEntry[] = [];
  activeToolProgressMessageIndex = -1;
  pendingCommand: { requestId: string; toolName: string; args: any; preview: string } | null = null;
  private currentSubscription: Subscription | null = null;
  private _requestGeneration = 0;
  showHistoryDropdown = false;
  renamingId: string | null = null;
  renameInput = '';

  position: { x: number; y: number } | null = null;
  size = { w: 350, h: 500 };
  private dragOffset = { x: 0, y: 0 };
  isDragging = false;
  private dragPotential = false;
  private dragStartPos = { x: 0, y: 0 };
  private resizeStart = { x: 0, y: 0 };
  private resizeStartSize = { w: 350, h: 500 };
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

  private markdownCache = new Map<string, SafeHtml>();

  parseMarkdown(content: string): SafeHtml {
    if (!content) return '';
    const cached = this.markdownCache.get(content);
    if (cached) return cached;
    try {
      let rawHtml = marked.parse(content) as string;
      rawHtml = rawHtml.replace(/<pre>/g, '<div class="code-block"><button class="code-copy-btn" type="button" aria-label="Copy code">copy</button><pre>');
      rawHtml = rawHtml.replace(/<\/pre>/g, '</pre></div>');
      const cleanHtml = DOMPurify.sanitize(rawHtml);
      const safe = this.sanitizer.bypassSecurityTrustHtml(cleanHtml);
      this.markdownCache.set(content, safe);
      return safe;
    } catch (e) {
      return content as any;
    }
  }

  toggleChat() {
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
        w: Math.max(280, Math.min(600, this.resizeStartSize.w + dx)),
        h: Math.max(300, Math.min(800, this.resizeStartSize.h + dy)),
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

    const renamePayload = [
      { role: 'system', content: 'Generate a short title (2-5 words) for this conversation. Respond with ONLY the title, nothing else.' },
      ...msgs
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
          aiSettings.apiUrl, aiSettings.token, aiSettings.model, renamePayload
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
      this.messages.push({ role: 'assistant', content: 'Please configure AI settings in the Settings menu first.' });
      this.userInput = '';
      return;
    }

    const mode = aiSettings.mode || (aiSettings.acpCommand ? 'acp' : 'web');
    aiSettings.mode = mode;

    if (mode === 'web' && !aiSettings.token) {
      this.messages.push({ role: 'assistant', content: 'Please configure a valid API token in the Settings menu first.' });
      this.userInput = '';
      return;
    }

    if (mode === 'acp' && !aiSettings.acpCommand) {
      this.messages.push({ role: 'assistant', content: 'Please configure the ACP command in the Settings menu first.' });
      this.userInput = '';
      return;
    }

    const userMessage = this.userInput;
    this.messages.push({ role: 'user', content: `${userMessage}` });
    this.userInput = '';
    this.saveMessages();
    this.isLoading = true;
    this.clearToolProgress();
    this.activeToolProgressMessageIndex = this.messages.length - 1;

    const activeTab = this.tabService.getSelectedTab();
    let context = '';
    if (this.useContext) {
      if (activeTab && activeTab.category === 'TERMINAL') {
        context = this.terminalInstanceService.getTerminalContent(activeTab.id);
      }
    }

    // NOTE: this injects xterm full content as a user message.
    // There is a parallel injection on the backend side:
    //   src-electron/adapter/ipc/ai/aiChat.js :: injectSessionContext()
    //   which injects session buffer + status summary as a system message.
    const payload = [...this.messages];
    if (context) {
        payload.push({ role: 'user', content: `Current terminal context:\n${context}` });
    }

    if (this.agentMode && mode === 'web') {
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
    this.currentSubscription = this.aiService.sendWebMessage(
      aiSettings.apiUrl,
      aiSettings.token,
      aiSettings.model,
      payload
    ).subscribe({
      next: (resp) => {
        this.currentSubscription = null;
        if (gen !== this._requestGeneration) return;
        let aiResponse = this.aiService.extractWebContent(resp);
        this.handleResponse(aiResponse, activeTab);
      },
      error: (err) => {
        this.currentSubscription = null;
        if (gen !== this._requestGeneration) return;
        console.error(err);
        this.messages.push({ role: 'assistant', content: 'Error communicating with AI. Please check your configuration.' });
        this.isLoading = false;
      }
    });
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
      const existing = this.toolProgress.find(t => t.toolName === data.toolName && t.args === data.args);
      if (!existing) {
        this.toolProgress.push({ ...data, expanded: !!data.error });
        this.cdr.detectChanges();
        this.scrollToBottom();
      }
    });

    const gen = this._requestGeneration;
    const useContext = aiSettings.useContext !== false;
    const chatSessionId = this.currentSessionId;
    this.currentSubscription?.unsubscribe();
    this.currentSubscription = this.aiService.sendWithTools(
      aiSettings.apiUrl,
      aiSettings.token,
      aiSettings.model,
      payload,
      aiSettings.crossSessionAccess,
      useContext,
      chatSessionId
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
        console.error(err);
        this.messages.push({ role: 'assistant', content: 'Error communicating with AI. Please check your configuration.' });
        this.isLoading = false;
      }
    });
  }

  private async sendAcpMessage(aiSettings: any, payload: any[], activeTab: any) {
    const gen = this._requestGeneration;
    let assistantMessage = { role: 'assistant', content: '' };
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
      this.messages.push({ role: 'assistant', content: aiResponse });
    }
    this.saveMessages();
    this.autoRenameSession();

    this.isLoading = false;
    this.cdr.detectChanges();
    this.scrollToBottom();
  }

  stop() {
    this._requestGeneration++;
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
    this.cdr.detectChanges();
  }

  private clearToolProgress() {
    this._requestGeneration++;
    this.toolProgress = [];
    this.activeToolProgressMessageIndex = -1;
    if (this.pendingCommand) {
      this.electronService.rejectCommand(this.pendingCommand.requestId);
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

  private saveSettings() {
    this.settingService.save();
  }
}
