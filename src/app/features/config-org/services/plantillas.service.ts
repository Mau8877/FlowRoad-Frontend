import { AuthService } from '#/app/features/auth/services/auth.service';
import { environment } from '#/environments/environment';
import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import {
  CreateTemplateRequest,
  TemplateResponse,
  UpdateTemplateRequest,
} from '../interfaces/plantillas.models';

@Injectable({
  providedIn: 'root',
})
export class TemplateService {
  private http = inject(HttpClient);
  private authService = inject(AuthService); // Buena práctica tenerlo aquí inyectado
  private readonly URL = `${environment.BASE_URL}/templates`;

  /**
   * 1. Obtiene todas las plantillas de la organización (Rol: ADMIN, DESIGNER)
   */
  GET_ALL_BY_ORGANIZATION(): Observable<TemplateResponse[]> {
    return this.http.get<TemplateResponse[]>(this.URL);
  }

  /**
   * 2. Obtiene plantillas activas por departamento (Rol: ADMIN, DESIGNER, WORKER)
   */
  GET_ACTIVE_BY_DEPARTMENT(departmentId: string): Observable<TemplateResponse[]> {
    return this.http.get<TemplateResponse[]>(`${this.URL}/department/${departmentId}`);
  }

  /**
   * 3. Obtener una plantilla específica por su ID
   */
  GET_BY_ID(id: string): Observable<TemplateResponse> {
    return this.http.get<TemplateResponse>(`${this.URL}/${id}`);
  }

  /**
   * 4. Crear una nueva plantilla (Rol: ADMIN, DESIGNER)
   */
  CREATE(payload: CreateTemplateRequest): Observable<TemplateResponse> {
    return this.http.post<TemplateResponse>(this.URL, payload);
  }

  /**
   * 5. Actualizar una plantilla existente (Sube versión en backend)
   */
  UPDATE(id: string, payload: UpdateTemplateRequest): Observable<TemplateResponse> {
    return this.http.put<TemplateResponse>(`${this.URL}/${id}`, payload);
  }

  /**
   * 6. Eliminación lógica (Soft Delete)
   */
  DELETE(id: string): Observable<void> {
    return this.http.delete<void>(`${this.URL}/${id}`);
  }

  /**
   * 7. Reactivar plantilla eliminada lógicamente
   */
  REACTIVATE(id: string): Observable<TemplateResponse> {
    return this.http.put<TemplateResponse>(`${this.URL}/${id}/reactivate`, {});
  }
}
