export type DocumentRequirementStatus = 'ACTIVE' | 'INACTIVE';

export type AllowedDocumentFileType =
  | 'pdf'
  | 'doc'
  | 'docx'
  | 'xls'
  | 'xlsx'
  | 'jpg'
  | 'jpeg'
  | 'png';

export const ALLOWED_DOCUMENT_FILE_TYPES: AllowedDocumentFileType[] = [
  'pdf',
  'doc',
  'docx',
  'xls',
  'xlsx',
  'jpg',
  'jpeg',
  'png',
];

export interface DocumentRequirement {
  id: string;
  orgId?: string;
  diagramId: string;
  nodeId: string;
  name: string;
  description?: string | null;
  required: boolean;
  allowedFileTypes: AllowedDocumentFileType[];
  maxFileSizeMb: number;
  readDepartmentIds: string[];
  uploadDepartmentIds: string[];
  editDepartmentIds: string[];
  clientCanRead?: boolean | null;
  clientCanUpload?: boolean | null;
  clientCanReplace?: boolean | null;
  status: DocumentRequirementStatus;
  createdAt?: string;
  createdBy?: string;
  updatedAt?: string;
  updatedBy?: string;
}

export interface DocumentRequirementRequest {
  name: string;
  description?: string | null;
  required: boolean;
  allowedFileTypes: AllowedDocumentFileType[];
  maxFileSizeMb: number;
  readDepartmentIds: string[];
  uploadDepartmentIds: string[];
  editDepartmentIds: string[];
  clientCanRead: boolean;
  clientCanUpload: boolean;
  clientCanReplace: boolean;
}
