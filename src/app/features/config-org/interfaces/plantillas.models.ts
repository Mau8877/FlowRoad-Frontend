/**
 * Tipos de campos soportados por el Motor de Formularios
 */
export enum FieldType {
  TEXT = 'TEXT',
  TEXTAREA = 'TEXTAREA',
  NUMBER = 'NUMBER',
  SELECT = 'SELECT',
  MULTIPLE_CHOICE = 'MULTIPLE_CHOICE',
  DATE = 'DATE',
  FILE = 'FILE',
  PHOTO = 'PHOTO',
}

/**
 * Propiedades de UI para renderizado dinámico (Grid System)
 */
export interface UIProps {
  order: number;
  gridCols: number;
  placeholder?: string;
}

/**
 * Opciones para campos de tipo SELECT o MULTIPLE_CHOICE
 */
export interface SelectOption {
  label: string;
  value: string;
}

/**
 * Definición atómica de un campo dentro de la plantilla
 */
export interface FieldDefinition {
  fieldId: string;
  type: FieldType;
  label: string;
  required: boolean;
  isInternalOnly: boolean;
  options?: SelectOption[];
  uiProps: UIProps;
  aiSuggestions?: string[];
}

/**
 * Respuesta del servidor (GET /templates)
 */
export interface TemplateResponse {
  id: string;
  name: string;
  description: string;
  departmentId: string;
  departmentName: string;
  version: number;
  isActive: boolean;
  fields: FieldDefinition[];
  createdAt: Date | string;
  createdBy: string;
}

/**
 * Petición para crear una nueva plantilla (POST /templates)
 */
export interface CreateTemplateRequest {
  name: string;
  description: string;
  departmentId: string;
  fields: FieldDefinition[];
}

/**
 * Petición para actualizar una plantilla (PUT /templates/{id})
 */
export interface UpdateTemplateRequest {
  name?: string;
  description?: string;
  departmentId?: string;
  isActive?: boolean;
  fields?: FieldDefinition[];
}
