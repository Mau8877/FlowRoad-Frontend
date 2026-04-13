import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '#/environments/environment';
import {
  DepartmentResponse,
  CreateDepartmentRequest,
  UpdateDepartmentRequest,
} from '#/app/features/config-org/interfaces/departamentos.model';
import { AuthService } from '#/app/features/auth/services/auth.service';
import { Observable, throwError } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class DepartmentService {
  private http = inject(HttpClient);
  private authService = inject(AuthService);
  private readonly URL = `${environment.BASE_URL}/departments`;

  /**
   * Obtiene todos los departamentos de la organización del usuario logueado
   */
  GET_BY_ORGANIZATION(): Observable<DepartmentResponse[]> {
    const orgId = this.authService.currentUser()?.orgId;

    if (!orgId) {
      console.error('Error: No se pudo obtener el orgId del usuario actual');
      return throwError(() => new Error('Organización no identificada'));
    }

    return this.http.get<DepartmentResponse[]>(`${this.URL}/organization/${orgId}`);
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
