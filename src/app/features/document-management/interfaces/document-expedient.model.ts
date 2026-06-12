export type DocumentExpedientStatus = 'PENDING' | 'UPLOADED' | string;

export interface DocumentManagementExpedientSummaryResponse {
  processInstanceId: string;
  processCode: string;
  diagramId: string;
  diagramName: string;
  diagramVersion: number;
  processStatus: string;
  clientId?: string | null;
  clientName?: string | null;
  clientEmail?: string | null;
  startedAt: string;
  updatedAt: string;
  finishedAt?: string | null;
  readableRequirementsCount: number;
  uploadedDocumentsCount: number;
  pendingDocumentsCount: number;
}

export interface DocumentManagementExpedientDetailResponse {
  processInstanceId: string;
  processCode: string;
  diagramId: string;
  diagramName: string;
  diagramVersion: number;
  processStatus: string;
  clientId?: string | null;
  clientName?: string | null;
  clientEmail?: string | null;
  startedAt: string;
  updatedAt: string;
  finishedAt?: string | null;
  items: DocumentExpedientItemResponse[];
}

export interface DocumentExpedientItemResponse {
  requirement: DocumentRequirement;
  currentFile?: DocumentFile | null;
  status: DocumentExpedientStatus;
  canRead: boolean;
  canUpload: boolean;
  canEdit: boolean;
}

export interface DocumentRequirement {
  id: string;
  orgId?: string;
  diagramId?: string;
  nodeId: string;
  name: string;
  description?: string | null;
  required: boolean;
  allowedFileTypes: string[];
  maxFileSizeMb: number;
  readDepartmentIds?: string[];
  uploadDepartmentIds?: string[];
  editDepartmentIds?: string[];
  clientCanRead?: boolean | null;
  clientCanUpload?: boolean | null;
  clientCanReplace?: boolean | null;
  status?: string;
  createdAt?: string;
  createdBy?: string;
  updatedAt?: string;
  updatedBy?: string;
}

export interface DocumentFile {
  id: string;
  orgId?: string;
  processInstanceId?: string;
  processAssignmentId?: string | null;
  diagramId?: string;
  nodeId?: string;
  documentRequirementId?: string;
  requirementName?: string;
  originalFileName: string;
  contentType: string;
  fileExtension: string;
  fileSizeBytes: number;
  status: string;
  version: number;
  uploadedBy?: string;
  uploadedByName: string;
  uploadedByDepartmentId?: string | null;
  createdAt: string;
  updatedAt: string;
  replacedByDocumentFileId?: string | null;
}

export interface DocumentDownloadUrlResponse {
  documentFileId: string;
  originalFileName: string;
  contentType: string;
  expiresInSeconds: number;
  downloadUrl: string;
}

export interface DocumentUploadResponse {
  documentFile: DocumentFile;
  contentType: string;
  size: number;
  originalFileName: string;
}
