export interface CargoSummary {
  id: string;
  name: string;
}

export interface DepartmentResponse {
  id: string;
  orgId: string;
  managerId?: string;
  name: string;
  code: string;
  slaHours: number;
  isActive: boolean;
  createdAt: string;
  cargos: CargoSummary[];
}

export interface CreateDepartmentRequest {
  orgId: string;
  managerId?: string;
  name: string;
  code: string;
  slaHours: number;
  cargos: string[];
}

export interface UpdateDepartmentRequest {
  managerId?: string;
  name: string;
  code: string;
  slaHours: number;
  isActive: boolean;
  cargos: string[];
}
