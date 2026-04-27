import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Subscription, finalize } from 'rxjs';

import { ProcessToastNotifications } from './components/process-toast-notifications/process-toast-notifications';
import { ProcessAssignmentNotification } from './interfaces/process-assignment-notification.model';
import { AssignmentResponse } from './interfaces/process-assignment.model';
import { ProcessInstanceSummaryResponse } from './interfaces/process-instance.model';
import { ProcessAssignmentService } from './services/process-assignment.service';
import { ProcessInstanceService } from './services/process-instance.service';
import { ProcessNotificationStateService } from './services/process-notification-state.service';
import { ProcessSocketService } from './services/process-socket.service';

@Component({
  selector: 'app-process-management',
  standalone: true,
  imports: [CommonModule, RouterLink, ProcessToastNotifications],
  templateUrl: './process-management.html',
  styleUrl: './process-management.css',
})
export class ProcessManagement implements OnInit, OnDestroy {
  private readonly processSocketService = inject(ProcessSocketService);
  private readonly processInstanceService = inject(ProcessInstanceService);
  private readonly processAssignmentService = inject(ProcessAssignmentService);
  private readonly processNotificationState = inject(ProcessNotificationStateService);

  private readonly subscriptions: Subscription[] = [];
  private readonly toastTimeouts = new Map<string, ReturnType<typeof setTimeout>>();

  private readonly dateFormatter = new Intl.DateTimeFormat('es-BO', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });

  public readonly processPageSize = 10;

  public connectionState = signal<'CONNECTED' | 'DISCONNECTED'>('DISCONNECTED');

  public notifications = signal<ProcessAssignmentNotification[]>([]);
  public toastNotifications = signal<ProcessAssignmentNotification[]>([]);
  public processInstances = signal<ProcessInstanceSummaryResponse[]>([]);
  public myPendingAssignments = signal<AssignmentResponse[]>([]);

  public loadingProcesses = signal(false);
  public loadingAssignments = signal(false);
  public currentProcessPage = signal(1);

  public processLoadError = signal<string | null>(null);
  public assignmentLoadError = signal<string | null>(null);

  public runningProcessesCount = computed(
    () => this.processInstances().filter((process) => process.status === 'RUNNING').length,
  );

  public pendingAssignmentProcessesCount = computed(
    () =>
      this.processInstances().filter((process) => process.status === 'PENDING_ASSIGNMENT').length,
  );

  public completedProcessesCount = computed(
    () => this.processInstances().filter((process) => process.status === 'COMPLETED').length,
  );

  public cancelledProcessesCount = computed(
    () => this.processInstances().filter((process) => process.status === 'CANCELLED').length,
  );

  public myPendingAssignmentsCount = computed(() => this.myPendingAssignments().length);

  public totalProcessPages = computed(() =>
    Math.max(1, Math.ceil(this.processInstances().length / this.processPageSize)),
  );

  public paginatedProcessInstances = computed(() => {
    const start = (this.currentProcessPage() - 1) * this.processPageSize;
    const end = start + this.processPageSize;

    return this.processInstances().slice(start, end);
  });

  public processRangeStart = computed(() => {
    if (this.processInstances().length === 0) {
      return 0;
    }

    return (this.currentProcessPage() - 1) * this.processPageSize + 1;
  });

  public processRangeEnd = computed(() =>
    Math.min(this.currentProcessPage() * this.processPageSize, this.processInstances().length),
  );

  ngOnInit(): void {
    this.loadInitialData();
    this.connectProcessSocket();
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach((subscription) => subscription.unsubscribe());
    this.toastTimeouts.forEach((timeoutId) => clearTimeout(timeoutId));
    this.toastTimeouts.clear();
    this.processSocketService.DISCONNECT();
  }

  clearNotifications(): void {
    this.notifications.set([]);
  }

  refreshData(): void {
    this.loadInitialData();
  }

  goToNextProcessPage(): void {
    this.currentProcessPage.update((page) => Math.min(page + 1, this.totalProcessPages()));
  }

  goToPreviousProcessPage(): void {
    this.currentProcessPage.update((page) => Math.max(page - 1, 1));
  }

  formatDate(value?: string | null): string {
    if (!value) {
      return 'Sin fecha';
    }

    const parsedDate = new Date(value);

    if (Number.isNaN(parsedDate.getTime())) {
      return 'Sin fecha';
    }

    return this.dateFormatter.format(parsedDate);
  }

  formatStatus(status: string): string {
    switch (status) {
      case 'RUNNING':
        return 'En ejecución';

      case 'PENDING_ASSIGNMENT':
        return 'Pendiente de asignación';

      case 'COMPLETED':
        return 'Completado';

      case 'CANCELLED':
        return 'Cancelado';

      case 'PENDING':
        return 'Pendiente';

      default:
        return status;
    }
  }

  removeToastNotification(assignmentId: string): void {
    this.clearToastTimeout(assignmentId);
    this.toastNotifications.update((current) =>
      current.filter((item) => item.assignmentId !== assignmentId),
    );
  }

  private loadInitialData(): void {
    this.loadProcessInstances();
    this.loadMyPendingAssignments();
  }

  private loadProcessInstances(): void {
    this.loadingProcesses.set(true);
    this.processLoadError.set(null);

    const subscription = this.processInstanceService
      .GET_ALL()
      .pipe(finalize(() => this.loadingProcesses.set(false)))
      .subscribe({
        next: (processInstances) => {
          this.processInstances.set(processInstances);
          this.clampCurrentProcessPage();
        },
        error: (error) => {
          console.error('[PROCESS-MANAGEMENT][LOAD_PROCESSES_ERROR]', error);
          this.processLoadError.set('No se pudieron cargar los procesos.');
        },
      });

    this.subscriptions.push(subscription);
  }

  private loadMyPendingAssignments(): void {
    this.loadingAssignments.set(true);
    this.assignmentLoadError.set(null);

    const subscription = this.processAssignmentService
      .GET_MY_PENDING_ASSIGNMENTS()
      .pipe(finalize(() => this.loadingAssignments.set(false)))
      .subscribe({
        next: (assignments) => {
          this.myPendingAssignments.set(assignments);
          this.processNotificationState.setUnreadCount(assignments.length);
        },
        error: (error) => {
          console.error('[PROCESS-MANAGEMENT][LOAD_ASSIGNMENTS_ERROR]', error);
          this.assignmentLoadError.set('No se pudieron cargar tus tareas pendientes.');
        },
      });

    this.subscriptions.push(subscription);
  }

  private connectProcessSocket(): void {
    this.processSocketService.CONNECT();

    this.subscriptions.push(
      this.processSocketService.onConnectionState$.subscribe((state) => {
        this.connectionState.set(state);
      }),
    );

    this.subscriptions.push(
      this.processSocketService.onAssignmentNotification$.subscribe((notification) => {
        this.addNotification(notification);
        this.addToastNotification(notification);
        this.processNotificationState.incrementUnread();
        this.processNotificationState.addAssignmentNotification(notification);

        this.loadMyPendingAssignments();
        this.loadProcessInstances();
      }),
    );

    this.subscriptions.push(
      this.processSocketService.onProcessInstanceNotification$.subscribe((notification) => {
        console.log('[PROCESS-MANAGEMENT][PROCESS_EVENT]', notification);

        const eventType = notification.type;

        if (
          eventType === 'PROCESS_CANCELLED' ||
          eventType === 'PROCESS_COMPLETED' ||
          eventType === 'PROCESS_UPDATED' ||
          eventType === 'PROCESS_PENDING_ASSIGNMENT' ||
          eventType === 'PROCESS_CREATED'
        ) {
          this.loadProcessInstances();
          this.loadMyPendingAssignments();
        }
      }),
    );
  }

  private addNotification(notification: ProcessAssignmentNotification): void {
    this.notifications.update((current) => {
      const alreadyExists = current.some((item) => item.assignmentId === notification.assignmentId);

      if (alreadyExists) {
        return current;
      }

      return [notification, ...current];
    });
  }

  private addToastNotification(notification: ProcessAssignmentNotification): void {
    this.toastNotifications.update((current) => {
      if (current.some((item) => item.assignmentId === notification.assignmentId)) {
        return current;
      }

      const next = [notification, ...current].slice(0, 3);
      const retainedIds = new Set(next.map((item) => item.assignmentId));

      current
        .filter((item) => !retainedIds.has(item.assignmentId))
        .forEach((item) => this.clearToastTimeout(item.assignmentId));

      return next;
    });

    this.startToastAutoClose(notification.assignmentId);
  }

  private startToastAutoClose(assignmentId: string): void {
    this.clearToastTimeout(assignmentId);

    const timeoutId = setTimeout(() => {
      this.removeToastNotification(assignmentId);
    }, 5000);

    this.toastTimeouts.set(assignmentId, timeoutId);
  }

  private clearToastTimeout(assignmentId: string): void {
    const timeoutId = this.toastTimeouts.get(assignmentId);

    if (!timeoutId) {
      return;
    }

    clearTimeout(timeoutId);
    this.toastTimeouts.delete(assignmentId);
  }

  private clampCurrentProcessPage(): void {
    if (this.currentProcessPage() < 1) {
      this.currentProcessPage.set(1);
      return;
    }

    if (this.currentProcessPage() > this.totalProcessPages()) {
      this.currentProcessPage.set(this.totalProcessPages());
    }
  }
}
