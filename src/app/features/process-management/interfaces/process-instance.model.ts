import { Diagram } from '#/app/features/diagram-editor/interfaces/diagram.models';

import { AssignmentResponse } from './process-assignment.model';

export type ProcessInstanceStatus = 'RUNNING' | 'PENDING_ASSIGNMENT' | 'COMPLETED' | 'CANCELLED';

export interface CreateProcessInstanceRequest {
  diagramId: string;
  requestData?: Record<string, unknown>;
}

export interface ProcessInstanceSummaryResponse {
  id: string;
  code: string;

  diagramId: string;
  diagramName: string;
  diagramVersion: number;

  status: ProcessInstanceStatus;

  activeNodeIds: string[];
  completedNodeIds: string[];

  startedByUserId: string;
  startedByUserName: string;

  startedAt: string;
  updatedAt: string;
  finishedAt?: string | null;
}

export interface HistoryFieldResponse {
  fieldId: string;
  label: string;
  value: unknown;
}

export interface HistoryResponse {
  id: string;

  processInstanceId: string;
  assignmentId: string;

  fromNodeId: string;
  fromNodeName: string;

  toNodeId: string;
  toNodeName: string;

  transitionLabel?: string | null;

  performedByUserId: string;
  performedByUserName: string;

  performedAt: string;

  templateDocumentId?: string | null;
  templateName?: string | null;

  /**
   * Respuesta cruda por fieldId.
   * Se mantiene por compatibilidad, pero para mostrar en pantalla usamos templateResponseFields.
   */
  templateResponseData?: Record<string, unknown>;

  /**
   * Respuesta lista para mostrar:
   * fieldId + label + value.
   */
  templateResponseFields?: HistoryFieldResponse[];

  attachments?: Record<string, unknown>[];

  comment?: string | null;
}

export interface ProcessInstanceDetailResponse {
  instance: ProcessInstanceSummaryResponse;
  requestData: Record<string, unknown>;
  activeAssignments: AssignmentResponse[];
  history: HistoryResponse[];
  diagram?: Diagram | null;
}
