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

  attrs?: Record<string, any>;
  router?: string | { name: string; args?: Record<string, any> };
  connector?: string | { name: string; args?: Record<string, any> };
  customData?: DiagramCellCustomData;
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
