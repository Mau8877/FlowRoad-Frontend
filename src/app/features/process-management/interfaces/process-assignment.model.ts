export type ProcessAssignmentStatus = 'PENDING' | 'COMPLETED' | 'CANCELLED';

export interface AssignmentResponse {
  id: string;
  processInstanceId: string;

  nodeId: string;
  nodeName: string;

  laneId?: string | null;
  laneName?: string | null;

  assignedDepartmentId?: string | null;
  assignedDepartmentName?: string | null;

  assignedCargoId?: string | null;
  assignedCargoName?: string | null;

  assignedUserId: string;
  assignedUserName: string;

  templateDocumentId?: string | null;
  templateName?: string | null;

  status: ProcessAssignmentStatus;

  createdAt: string;
  assignedAt?: string | null;
  completedAt?: string | null;
}

export interface CompleteAssignmentRequest {
  transitionLabel?: string | null;
  targetNodeId?: string | null;
  templateResponseData?: Record<string, unknown>;
  attachments?: Record<string, unknown>[];
  comment?: string | null;
}
