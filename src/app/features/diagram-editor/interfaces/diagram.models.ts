// ==========================================
// 1. MODELOS DE VISTA (REST API)
// ==========================================

// Usado para listar en la tabla (sin cargar el JSON gigante)
export interface DiagramSummaryResponse {
  id: string;
  name: string;
  description: string;
  version: number;
  isActive: boolean;
  updatedAt: string; // Las fechas llegan como string ISO desde Java
}

// ==========================================
// 2. MODELO DE DOMINIO (El Archivo Oficial)
// ==========================================

export interface Diagram {
  id: string;
  orgId: string;
  name: string;
  description: string;
  version: number;
  isActive: boolean;
  cells: DiagramCell[]; // Aquí vive el dibujo de JointJS
  createdAt: string;
  createdBy: string;
  updatedAt: string;
}

// Sub-documentos que componen el dibujo
export interface DiagramCell {
  id: string;
  type: string; // Ej: 'standard.Rectangle' o 'standard.Link'

  position?: Position; // Opcional: Las flechas no tienen posición
  size?: Size; // Opcional: Las flechas no tienen tamaño

  source?: CellReference; // Opcional: Los nodos no tienen origen
  target?: CellReference; // Opcional: Los nodos no tienen destino

  attrs?: Record<string, any>; // Estilos visuales de JointJS
  customData?: Record<string, any>; // Metadatos de FlowRoad (templateId, roles)
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
// 3. MODELOS DE SESIÓN Y WEBSOCKETS
// ==========================================

// Lo que responde el backend al hacer GET /design-sessions/join/{id}
export interface JoinSessionResponse {
  sessionToken: string;
  diagramId: string;
  snapshot: string; // Llega como un string de JSON (hay que hacerle JSON.parse())
  currentUsers: ActiveUser[];
}

export interface ActiveUser {
  userId: string;
  nombre: string;
  color: string; // Ej: '#FF5733'
  cursor?: Position;
  lastPing: string;
}

// El paquete de datos que viaja a la velocidad de la luz por STOMP
export interface SocketOperationMessage {
  opType: string; // Ej: 'MOVE_LIVE', 'MOVE', 'RENAME', 'PING'
  nodeId: string; // Ej: 'act-1'
  delta: Record<string, any>; // Ej: { x: 100, y: 250 } o { text: "Nueva Actividad" }
  userId: string;
}
