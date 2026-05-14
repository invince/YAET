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
import {firstValueFrom} from 'rxjs';
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
    MatSlideToggleModule
  ]
})
export class AiChatComponent implements OnInit, AfterViewChecked {
  @ViewChild('scrollMe') private myScrollContainer!: ElementRef;
  isOpen = false;
  userInput = '';
  messages: { role: string, content: string }[] = [];
  isLoading = false;
  showHistoryDropdown = false;
  renamingId: string | null = null;
  renameInput = '';

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
    private historyService: AiChatHistoryService
  ) { }

  ngOnInit(): void {
    const current = this.historyService.current;
    if (current) {
      this.messages = [...current.messages];
    }
  }

  ngAfterViewChecked() {
    this.scrollToBottom();
  }

  scrollToBottom(): void {
    try {
      this.myScrollContainer.nativeElement.scrollTop = this.myScrollContainer.nativeElement.scrollHeight;
    } catch (err) { }
  }

  parseMarkdown(content: string): SafeHtml {
    if (!content) return '';
    try {
      const rawHtml = marked.parse(content) as string;
      const cleanHtml = DOMPurify.sanitize(rawHtml);
      return this.sanitizer.bypassSecurityTrustHtml(cleanHtml);
    } catch (e) {
      return content;
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
    this.saveMessages();
    this.historyService.createNew();
    this.messages = [...(this.historyService.current?.messages ?? [])];
    this.showHistoryDropdown = false;
    this.cdr.detectChanges();
  }

  switchSession(id: string) {
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

    const activeTab = this.tabService.getSelectedTab();
    let context = '';
    if (this.useContext) {
      if (activeTab && activeTab.category === 'TERMINAL') {
        context = this.terminalInstanceService.getTerminalContent(activeTab.id);
      }
    }

    const payload = [...this.messages];
    if (context) {
        payload.push({ role: 'user', content: `Current terminal context:\n${context}` });
    }

    if (this.agentMode) {
      payload.push({ role: 'user', content: `You are in Agent Mode. Please respond ONLY with the raw command to execute in the shell. Do NOT wrap it in markdown block. Do NOT include any other text.` });
    }

    if (mode === 'acp') {
      this.sendAcpMessage(aiSettings, payload, activeTab);
    } else {
      this.sendWebMessage(aiSettings, payload, activeTab);
    }
  }

  private sendWebMessage(aiSettings: any, payload: any[], activeTab: any) {
    this.aiService.sendWebMessage(
      aiSettings.apiUrl,
      aiSettings.token,
      aiSettings.model,
      payload
    ).subscribe({
      next: (resp) => {
        let aiResponse = this.aiService.extractWebContent(resp);
        this.handleResponse(aiResponse, activeTab);
      },
      error: (err) => {
        console.error(err);
        this.messages.push({ role: 'assistant', content: 'Error communicating with AI. Please check your configuration.' });
        this.isLoading = false;
      }
    });
  }

  private async sendAcpMessage(aiSettings: any, payload: any[], activeTab: any) {
    let assistantMessage = { role: 'assistant', content: '' };
    this.messages.push(assistantMessage);

    this.electronService.removeAcpChunkListeners();
    this.electronService.onAcpChunk((data: any) => {
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
      // Avoid duplication if the same chunk is somehow received twice or overlapping
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

      this.electronService.removeAcpChunkListeners();

      // Stop the global spinner once we have a final response
      this.isLoading = false;
      this.cdr.detectChanges();

      if (!assistantMessage.content && resp) {
          assistantMessage.content = resp;
      }

      this.handleResponse(assistantMessage.content, activeTab);
    } catch (err) {
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

    if (this.agentMode) {
        const codeBlockRegex = /```[\s\S]*?\n([\s\S]*?)```/g;
        const match = codeBlockRegex.exec(aiResponse);
        if (match) {
            aiResponse = match[1].trim();
        } else {
            aiResponse = aiResponse.trim();
        }
    }

    const lastMsg = this.messages[this.messages.length - 1];
    if (!lastMsg || lastMsg.role !== 'assistant') {
      this.messages.push({ role: 'assistant', content: aiResponse });
    }
    this.saveMessages();
    this.autoRenameSession();

    if (this.agentMode && activeTab && activeTab.category === 'TERMINAL') {
        this.electronTerminalService.sendTerminalInput(activeTab.id, aiResponse + '\r');
    }

    this.isLoading = false;
    this.cdr.detectChanges();
    this.scrollToBottom();
  }

  stop() {
    this.isLoading = false;
    this.electronService.removeAcpChunkListeners();
    this.cdr.detectChanges();
  }

  private saveSettings() {
    this.settingService.save();
  }
}
