import {Injectable, OnDestroy} from '@angular/core';
import {MatSnackBar, MatSnackBarConfig} from '@angular/material/snack-bar';
import {Subscription} from 'rxjs';

interface Notification {
  message: string;
  btnLabel: string;
  options: MatSnackBarConfig;
  onAction: () => void;
}

@Injectable({
  providedIn: 'root',
})
export class NotificationService implements OnDestroy {
  private messages: Notification[] = [];
  private isProcessingQueue = false;
  private subscriptions: Subscription[] = [];

  constructor(private _snackBar: MatSnackBar) {}


  public queue(
    message: string,
    btnLabel: string,
    options: MatSnackBarConfig,
    onAction: () => void
  ): void {
    if (!message) {
      return;
    }

    const notification: Notification = { message, btnLabel, options, onAction };
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
    this.queue(message, btnLabel, { duration: 3000, panelClass: [ 'error-snackbar' ] },  onAction);
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
      const snackBarRef = this._snackBar.open(
        notification.message,
        notification.btnLabel,
        notification.options
      );

      const actionSub = snackBarRef.onAction().subscribe(() => {
        notification.onAction();
      });

      const afterDismissSub = snackBarRef.afterDismissed().subscribe(() => {
        resolve(); // Resolve the promise after dismissal.
      });

      this.subscriptions.push(actionSub, afterDismissSub);
    });
  }

  /**
   * Cleans up subscriptions on service destruction.
   */
  ngOnDestroy(): void {
    this.subscriptions.forEach((subscription) => subscription.unsubscribe());
  }
}
