export interface LoginRequest {
  email: string;
  password: string;
}

export interface AuthResponse {
  token: string;
  message: string;
}

export interface RegisterRequest {
  nombre: string;
  apellido: string;
  email: string;
  password: string;
}

export interface User {
  id: string;
  email: string;
  role: string;
  orgId?: string;
  departmentId?: string;
  cargoId?: string;
  workload?: number;
  isActive: boolean;
  profile?: {
    nombre?: string;
    apellido?: string;
    telefono?: string;
    avatarUrl?: string;
    direccion?: string;
  };
  createdAt: string;

  // Campo calculado (opcional)
  displayName?: string;
}

export interface JwtPayload {
  role: string;
  userId: string;
  orgId?: string;
  sub: string;
  iat: number;
  exp: number;
}
