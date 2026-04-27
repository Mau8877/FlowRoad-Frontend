// ==========================================
// 1. MODELOS DE VISTA (REST API)
// ==========================================

export interface DiagramSummaryResponse {
  id: string;
  name: string;
  description: string;
  version: number;
  isActive: boolean;
  updatedAt: string;
}

// ==========================================
// 2. MODELO DE DOMINIO
// ==========================================

export interface Diagram {
  id: string;
  orgId: string;
  name: string;
  description: string;
  version: number;
  isActive: boolean;
  cells: DiagramCell[];
  lanes?: DiagramLane[];
  createdAt: string;
  createdBy: string;
  updatedAt: string;
}

export type DiagramNodeType =
  | 'INITIAL'
  | 'ACTION'
  | 'DECISION'
  | 'MERGE'
  | 'FORK'
  | 'JOIN'
  | 'FINAL'
  | 'OBJECT_SIGNAL';

export type EditorTool =
  | 'PAN'
  | 'SELECT'
  | 'LANE'
  | 'INITIAL'
  | 'ACTION'
  | 'DECISION'
  | 'FORK_JOIN'
  | 'FINAL'
  | 'LINK'
  | 'DELETE'
  | 'AI';

export interface DiagramCellCustomData {
  nombre?: string;
  tipo?: DiagramNodeType | string;
  laneId?: string;
  [key: string]: any;
}

export interface DiagramCell {
  id: string;
  type: string;

  position?: Position;
  size?: Size;

  source?: CellReference;
  target?: CellReference;
  vertices?: Position[];
  labels?: DiagramLinkLabel[];

  attrs?: Record<string, any>;
  router?: string | { name: string; args?: Record<string, any> };
  connector?: string | { name: string; args?: Record<string, any> };
  customData?: DiagramCellCustomData;
}

export interface DiagramLinkLabel {
  position?: number | { distance?: number; offset?: number };
  attrs?: Record<string, any>;
}

export interface Position {
  x: number;
  y: number;
}

export interface Size {
  width: number;
  height: number;
}

export interface CellReference {
  id: string;
  port?: string;
}

export interface DiagramLane {
  id: string;
  departmentId: string;
  departmentName: string;
  order: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

// ==========================================
// 3. MODELOS DE SESIÓN Y SOCKET
// ==========================================

export interface JoinSessionResponse {
  sessionToken: string;
  diagramId: string;
  snapshot: string;
  lanesSnapshot: string;
  currentUsers: ActiveUser[];
}

export interface ActiveUser {
  userId: string;
  nombre: string;
  color: string;
  cursor?: Position;
  lastPing: string;
}

export interface SocketOperationMessage {
  opType:
    | 'MOVE_LIVE'
    | 'MOVE_COMMIT'
    | 'CURSOR'
    | 'CREATE_NODE'
    | 'UPDATE_NODE'
    | 'DELETE_CELL'
    | 'CREATE_LINK'
    | 'UPDATE_LINK'
    | 'DELETE_LINK'
    | 'LOCK_CELL'
    | 'UNLOCK_CELL'
    | 'LOCK_REJECTED'
    | 'SYNC_LANES';

  cellId: string;
  delta: Record<string, any>;
  userId: string;
  dragId?: string;
}

// ==========================================
// 4. MODELOS IA DIAGRAMADOR
// ==========================================

export type DiagramAiMode = 'CREATE' | 'EDIT';

export interface DiagramAiRequest {
  mode: DiagramAiMode;
  user_message: string;
  current_diagram: unknown | null;
  available_departments: DiagramAiDepartmentContext[];
  existing_templates: DiagramAiExistingTemplateContext[];
}

export interface DiagramAiDepartmentContext {
  id: string;
  name: string;
}

export interface DiagramAiExistingTemplateContext {
  id: string;
  name: string;
  description?: string | null;
  department_id?: string | null;
  department_name?: string | null;
  fields: DiagramAiExistingTemplateField[];
}

export interface DiagramAiExistingTemplateField {
  field_id?: string | null;
  type: string;
  label: string;
  required: boolean;
  options: DiagramAiTemplateOption[];
  ui_props?: {
    grid_cols: number;
  } | null;
}

export interface DiagramAiTemplateOption {
  label: string;
  value: string;
}

export interface DiagramAiResponse {
  message: string;
  mode: DiagramAiMode;
  diagram: {
    name: string;
    description: string;
    cells: DiagramCell[];
    lanes: DiagramLane[];
  };
  template_suggestions: DiagramAiTemplateSuggestion[];
  warnings: string[];
  changes_summary: string[];
}

export interface DiagramAiTemplateSuggestion {
  node_id: string;
  node_name: string;
  strategy: 'USE_EXISTING_TEMPLATE' | 'CREATE_NEW_TEMPLATE';
  existing_template_id?: string | null;
  existing_template_name?: string | null;
  template?: DiagramAiSuggestedTemplate | null;
  reason?: string | null;
}

export interface DiagramAiSuggestedTemplate {
  name: string;
  description: string;
  department_id: string;
  department_name?: string | null;
  fields: DiagramAiSuggestedTemplateField[];
}

export interface DiagramAiSuggestedTemplateField {
  type: string;
  label: string;
  required: boolean;
  options: DiagramAiTemplateOption[];
  ui_props: {
    grid_cols: number;
  };
}
