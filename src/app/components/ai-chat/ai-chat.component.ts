import {CommonModule} from '@angular/common';
import {AfterViewChecked, ChangeDetectorRef, Component, ElementRef, OnInit, ViewChild} from '@angular/core';
import {FormsModule} from '@angular/forms';
import {MatButtonModule} from '@angular/material/button';
import {MatFormFieldModule} from '@angular/material/form-field';
import {MatIconModule} from '@angular/material/icon';
import {MatInputModule} from '@angular/material/input';
import {MatProgressSpinnerModule} from '@angular/material/progress-spinner';
import {MatSlideToggleModule} from '@angular/material/slide-toggle';
import {DomSanitizer, SafeHtml} from '@angular/platform-browser';
import DOMPurify from 'dompurify';
import {marked} from 'marked';
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
    private sanitizer: DomSanitizer
  ) { }

  ngOnInit(): void {
    this.messages.push({ role: 'assistant', content: 'Hello! How can I help you today?' });
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

    // Note: We don't push to this.messages here anymore because
    // sendAcpMessage/sendWebMessage already managed the message object for streaming.
    // However, for non-streaming web messages, we might still need to push?
    // Let's check sendWebMessage.

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
