export interface CargoResponse {
  id: string;
  orgId: string;
  name: string;
  level: number;
  isActive: boolean;
}

export interface CreateCargoRequest {
  orgId: string;
  name: string;
  level: number;
}

export interface UpdateCargoRequest {
  name: string;
  level: number;
  isActive: boolean;
}
