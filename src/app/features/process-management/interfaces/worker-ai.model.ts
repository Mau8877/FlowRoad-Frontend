import {
  FieldType,
  TemplateResponse,
} from '#/app/features/config-org/interfaces/plantillas.models';

export interface WorkerAiRequest {
  worker_message: string;
  task_name?: string | null;
  process_name?: string | null;
  worker_name?: string | null;
  department_name?: string | null;
  target_field_id?: string | null;
  template: TemplateResponse;
  current_values: Record<string, unknown>;
  extra_context?: Record<string, unknown>;
}

export interface WorkerFieldSuggestion {
  field_id: string;
  label: string;
  type: FieldType;
  suggested_value: unknown;
  confidence: number;
  warning?: string | null;
}

export interface WorkerAiResponse {
  message: string;
  field_suggestions: WorkerFieldSuggestion[];
  warnings: string[];
}
