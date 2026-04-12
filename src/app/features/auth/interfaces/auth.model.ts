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
  uid: string;
  email: string;
  displayName: string;
  roles: string[];
}

export interface JwtPayload {
  role: string;
  userId: string;
  orgId?: string;
  sub: string;
  iat: number;
  exp: number;
}
