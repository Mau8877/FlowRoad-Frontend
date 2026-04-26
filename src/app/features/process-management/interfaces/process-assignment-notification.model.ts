export interface ProcessAssignmentNotification {
  type: string;

  assignmentId: string;
  processInstanceId: string;
  processCode: string;

  diagramId: string;
  diagramName: string;

  nodeId: string;
  nodeName: string;

  assignedUserId: string;
  assignedUserName: string;

  assignedDepartmentId?: string | null;
  assignedDepartmentName?: string | null;

  assignedCargoId?: string | null;
  assignedCargoName?: string | null;

  templateDocumentId?: string | null;
  templateName?: string | null;

  assignedAt: string;
}
