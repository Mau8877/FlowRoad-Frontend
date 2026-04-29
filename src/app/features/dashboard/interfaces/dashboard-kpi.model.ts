export interface DashboardKpiResponse {
  totalProcesses: number;
  completedProcesses: number;
  runningProcesses: number;
  pendingAssignmentProcesses: number;
  cancelledProcesses: number;
  completionRate: number;
  averageCompletionTimeMinutes: number;
  averageCompletionTimeLabel: string;
  processesByStatus: StatusCountResponse[];
  pendingTasksByDepartment: DepartmentPendingTasksResponse[];
  mostUsedProcesses: PopularProcessResponse[];
  generatedAt: string;
}

export interface StatusCountResponse {
  status: ProcessStatus;
  label: string;
  count: number;
}

export interface DepartmentPendingTasksResponse {
  departmentId: string | null;
  departmentName: string;
  pendingTasks: number;
}

export interface PopularProcessResponse {
  diagramId: string | null;
  diagramName: string;
  totalInstances: number;
}

export interface DashboardAiAnalysisResponse {
  summary: string;
  severity: DashboardAiSeverity;
  severityLabel: string;
  mainBottleneck: string;
  evidence: string[];
  recommendations: string[];
  generatedBy: 'AI' | 'LOCAL_FALLBACK';
  generatedAt: string;
  providerError: string | null;
}

export type ProcessStatus = 'RUNNING' | 'PENDING_ASSIGNMENT' | 'COMPLETED' | 'CANCELLED';

export type DashboardAiSeverity = 'LOW' | 'MEDIUM' | 'HIGH';
