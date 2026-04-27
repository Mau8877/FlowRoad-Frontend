import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { RouterLink } from '@angular/router';

import { ProcessAssignmentNotification } from '../../interfaces/process-assignment-notification.model';

@Component({
  selector: 'app-process-toast-notifications',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './process-toast-notifications.html',
})
export class ProcessToastNotifications {
  @Input({ required: true }) notifications: ProcessAssignmentNotification[] = [];
  @Output() close = new EventEmitter<string>();

  closeToast(assignmentId: string): void {
    this.close.emit(assignmentId);
  }
}
