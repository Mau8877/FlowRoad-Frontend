import { ProcessInstanceStatus } from './process-instance.model';

export type ProcessInstanceNotificationType =
  | 'PROCESS_CREATED'
  | 'PROCESS_UPDATED'
  | 'PROCESS_COMPLETED'
  | 'PROCESS_CANCELLED'
  | 'PROCESS_PENDING_ASSIGNMENT';

export interface ProcessInstanceNotification {
  type: ProcessInstanceNotificationType | string;

  processInstanceId: string;
  processCode: string;

  diagramId: string;
  diagramName: string;

  status: ProcessInstanceStatus;

  updatedAt: string;
  finishedAt?: string | null;
}
