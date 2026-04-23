import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '#/environments/environment';
import {
  DepartmentResponse,
  CreateDepartmentRequest,
  UpdateDepartmentRequest,
} from '#/app/features/config-org/interfaces/departamentos.model';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class DepartmentService {
  private http = inject(HttpClient);
  private readonly URL = `${environment.BASE_URL}/departments`;

  /**
   * Obtiene todos los departamentos de la organización del usuario logueado
   */
  GET_BY_ORGANIZATION(): Observable<DepartmentResponse[]> {
    return this.http.get<DepartmentResponse[]>(`${this.URL}/my-organization`);
  }

  /**
   * Crea un nuevo departamento
   */
  CREATE(payload: CreateDepartmentRequest): Observable<DepartmentResponse> {
    return this.http.post<DepartmentResponse>(`${this.URL}`, payload);
  }

  /**
   * Actualiza un departamento existente usando PATCH
   */
  UPDATE(id: string, payload: UpdateDepartmentRequest): Observable<DepartmentResponse> {
    return this.http.patch<DepartmentResponse>(`${this.URL}/${id}`, payload);
  }

  /**
   * Eliminación lógica del departamento
   */
  DELETE(id: string): Observable<void> {
    return this.http.delete<void>(`${this.URL}/${id}`);
  }

  /**
   * Obtener un departamento específico por su ID
   */
  GET_BY_ID(id: string): Observable<DepartmentResponse> {
    return this.http.get<DepartmentResponse>(`${this.URL}/${id}`);
  }
}