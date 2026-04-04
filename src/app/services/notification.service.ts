import {Injectable, OnDestroy} from '@angular/core';
import {MessageService} from 'primeng/api';

interface Notification {
  message: string;
  btnLabel: string;
  severity: 'success' | 'info' | 'warn' | 'error';
  duration: number;
  onAction: () => void;
}

@Injectable({
  providedIn: 'root',
})
export class NotificationService implements OnDestroy {
  private messages: Notification[] = [];
  private isProcessingQueue = false;

  constructor(private messageService: MessageService) {}


  public queue(
    message: string,
    btnLabel: string,
    options: { duration?: number; severity?: 'success' | 'info' | 'warn' | 'error' },
    onAction: () => void
  ): void {
    if (!message) {
      return;
    }

    const notification: Notification = {
      message,
      btnLabel,
      severity: options.severity || 'info',
      duration: options.duration || 3000,
      onAction
    };
    this.messages.push(notification);
    this.startQueueRunner();
  }


  public info(
    message: string,
    btnLabel: string = 'OK',
    onAction: () => void = () => {}
  ): void {
   this.queue(message, btnLabel, { duration: 3000},  onAction);
  }

  public error(
    message: string,
    btnLabel: string = 'OK',
    onAction: () => void = () => {}
  ): void {
    this.queue(message, btnLabel, { duration: 3000, severity: 'error' },  onAction);
  }

  /**
   * Starts processing the queue if not already running.
   */
  private startQueueRunner(): void {
    if (this.isProcessingQueue) {
      return;
    }

    this.isProcessingQueue = true;
    this.processQueue();
  }

  /**
   * Processes the queue until it is empty.
   */
  private async processQueue(): Promise<void> {
    while (this.messages.length > 0) {
      const notification = this.messages.shift()!;
      await this.showNotification(notification);
    }

    this.isProcessingQueue = false; // Stop the queue runner when the queue is empty.
  }

  /**
   * Displays a notification and waits for it to be dismissed.
   */
  private showNotification(notification: Notification): Promise<void> {
    return new Promise((resolve) => {
      // PrimeNG Toast API
      this.messageService.add({
        severity: notification.severity,
        summary: notification.message,
        detail: notification.btnLabel !== 'OK' ? notification.btnLabel : '',
        life: notification.duration
      });

      // Execute the action callback if provided
      if (notification.onAction) {
        notification.onAction();
      }

      // Resolve after the duration
      setTimeout(() => {
        resolve();
      }, notification.duration);
    });
  }

  /**
   * Cleans up on service destruction.
   */
  ngOnDestroy(): void {
    this.messageService.clear();
  }
}
