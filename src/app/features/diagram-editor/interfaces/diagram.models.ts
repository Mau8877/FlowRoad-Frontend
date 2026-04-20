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
  createdAt: string;
  createdBy: string;
  updatedAt: string;
}

export interface DiagramCell {
  id: string;
  type: string;

  position?: Position;
  size?: Size;

  source?: CellReference;
  target?: CellReference;

  attrs?: Record<string, any>;
  customData?: Record<string, any>;
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

// ==========================================
// 3. MODELOS DE SESIÓN Y SOCKET
// ==========================================

export interface JoinSessionResponse {
  sessionToken: string;
  diagramId: string;
  snapshot: string;
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
    | 'LOCK_REJECTED';

  cellId: string;
  delta: Record<string, any>;
  userId: string;
}
