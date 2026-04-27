import { Injectable, signal } from '@angular/core';

import { ProcessAssignmentNotification } from '../interfaces/process-assignment-notification.model';

@Injectable({
  providedIn: 'root',
})
export class ProcessNotificationStateService {
  public unreadAssignmentsCount = signal(0);
  public latestAssignmentNotifications = signal<ProcessAssignmentNotification[]>([]);

  incrementUnread(): void {
    this.unreadAssignmentsCount.update((count) => count + 1);
  }

  setUnreadCount(count: number): void {
    this.unreadAssignmentsCount.set(Math.max(0, count));
  }

  clearUnread(): void {
    this.unreadAssignmentsCount.set(0);
  }

  addAssignmentNotification(notification: ProcessAssignmentNotification): void {
    this.latestAssignmentNotifications.update((current) => {
      const withoutDuplicate = current.filter((item) => item.assignmentId !== notification.assignmentId);
      return [notification, ...withoutDuplicate].slice(0, 20);
    });
  }
}
