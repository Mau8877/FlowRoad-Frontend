export enum Roles {
  RECEP = 'RECEP', // Super Admin
  ADMIN = 'ADMIN', // Admin de Organización
  WORKER = 'WORKER', // Operativo
  CLIENT = 'CLIENT', // Solicitante
  DESIGNER = 'DESIGNER', // Diseñador de procesos
}

// 2. Perfil del Usuario (Nested object en Java)
export interface UserProfile {
  nombre: string;
  apellido: string;
  telefono?: string;
  direccion?: string;
  avatarUrl?: string;
}

// 3. Request para Registro de Trabajador (POST)
export interface RegisterWorkerRequest {
  email: string;
  password: string;
  role: Roles;
  orgId: string;
  departmentId: string;
  cargoId: string;
  profile: UserProfile;
}

// 4. Response del Usuario (GET / List)
// Importante: Aquí solemos recibir los nombres de depto y cargo para la tabla
export interface UserResponse {
  id: string;
  email: string;
  role: Roles;
  orgId: string;
  department: { id: string; name: string };
  cargo: { id: string; name: string };
  workload: number;
  isActive: boolean;
  profile: UserProfile;
  createdAt: string;
}

export interface UpdateUserRequest {
  profile: UserProfile;
  departmentId?: string;
  cargoId?: string;
  isActive?: boolean;
}
