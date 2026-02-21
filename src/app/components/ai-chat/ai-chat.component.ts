import {CommonModule} from '@angular/common';
import {AfterViewChecked, Component, ElementRef, OnInit, ViewChild} from '@angular/core';
import {FormsModule} from '@angular/forms';
import {MatButtonModule} from '@angular/material/button';
import {MatFormFieldModule} from '@angular/material/form-field';
import {MatIconModule} from '@angular/material/icon';
import {MatInputModule} from '@angular/material/input';
import {MatProgressSpinnerModule} from '@angular/material/progress-spinner';
import {MatSlideToggleModule} from '@angular/material/slide-toggle';
import {DomSanitizer, SafeHtml} from '@angular/platform-browser';
import {marked} from 'marked';
import {AiChatService} from '../../services/ai-chat.service';
import {AiService} from '../../services/ai.service';
import {ElectronTerminalService} from '../../services/electron/electron-terminal.service';
import {SettingStorageService} from '../../services/setting-storage.service';
import {TabService} from '../../services/tab.service';
import {TerminalInstanceService} from '../../services/terminal-instance.service';

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
  useContext = true;
  agentMode = false;

  constructor(
    private aiService: AiService,
    private settingStorage: SettingStorageService,
    private tabService: TabService,
    private terminalInstanceService: TerminalInstanceService,
    private electronTerminalService: ElectronTerminalService,
    public aiChatService: AiChatService,
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
      const html = marked.parse(content) as string;
      return this.sanitizer.bypassSecurityTrustHtml(html);
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
    if (!aiSettings || !aiSettings.token) {
      this.messages.push({ role: 'assistant', content: 'Please configure AI settings with a valid token in the Settings menu first.' });
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

    this.aiService.sendMessage(
      aiSettings.apiUrl,
      aiSettings.token,
      aiSettings.model,
      payload
    ).subscribe({
      next: (resp) => {
        let aiResponse = resp.choices[0].message.content;

        if (this.agentMode) {
            // Strip any markdown code blocks if the AI ignored instructions
            const codeBlockRegex = /```[\s\S]*?\n([\s\S]*?)```/g;
            const match = codeBlockRegex.exec(aiResponse);
            if (match) {
                aiResponse = match[1].trim();
            } else {
                aiResponse = aiResponse.trim();
            }
        }

        this.messages.push({ role: 'assistant', content: aiResponse });

        if (this.agentMode && activeTab && activeTab.category === 'TERMINAL') {
            this.electronTerminalService.sendTerminalInput(activeTab.id, aiResponse + '\r');
        }

        this.isLoading = false;
      },
      error: (err) => {
        console.error(err);
        this.messages.push({ role: 'assistant', content: 'Error communicating with AI. Please check your configuration.' });
        this.isLoading = false;
      }
    });
  }
}
