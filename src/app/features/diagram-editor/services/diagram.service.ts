import { environment } from '#/environments/environment';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { Diagram, DiagramSummaryResponse, JoinSessionResponse } from '../interfaces/diagram.models';

@Injectable({
  providedIn: 'root',
})
export class DiagramService {
  private http = inject(HttpClient);

  private readonly DIAGRAMS_URL = `${environment.BASE_URL}/diagrams`;
  private readonly SESSIONS_URL = `${environment.BASE_URL}/design-sessions`;

  /**
   * 1. Obtiene todos los diagramas de la organización
   */
  GET_ALL_BY_ORGANIZATION(): Observable<DiagramSummaryResponse[]> {
    return this.http.get<DiagramSummaryResponse[]>(this.DIAGRAMS_URL);
  }

  /**
   * 2. Crear un nuevo diagrama (Crea uno por defecto en el backend)
   */
  CREATE(): Observable<DiagramSummaryResponse> {
    return this.http.post<DiagramSummaryResponse>(this.DIAGRAMS_URL, {});
  }

  /**
   * 3. Obtener diagrama completo por ID
   */
  GET_BY_ID(id: string): Observable<Diagram> {
    return this.http.get<Diagram>(`${this.DIAGRAMS_URL}/${id}`);
  }

  /**
   * 4. Actualizar metadatos (Nombre y Descripción)
   */
  UPDATE_METADATA(
    id: string,
    name: string,
    description: string,
  ): Observable<DiagramSummaryResponse> {
    const params = new HttpParams().set('name', name).set('description', description);

    return this.http.put<DiagramSummaryResponse>(`${this.DIAGRAMS_URL}/${id}`, null, { params });
  }

  /**
   * 5. Eliminación lógica (Soft Delete / Toggle Active)
   */
  TOGGLE_ACTIVE(id: string): Observable<void> {
    return this.http.delete<void>(`${this.DIAGRAMS_URL}/${id}`);
  }

  // ==========================================
  // RUTAS DE SESIÓN Y ARCHIVOS (.flowroad)
  // ==========================================

  /**
   * 6. Entrar a una sala (Obtiene el Token STOMP y el Snapshot)
   */
  JOIN_SESSION(diagramId: string): Observable<JoinSessionResponse> {
    return this.http.get<JoinSessionResponse>(`${this.SESSIONS_URL}/join/${diagramId}`);
  }

  /**
   * 7. Exportar diagrama (Devuelve la data cruda para el .flowroad)
   */
  EXPORT(id: string): Observable<Diagram> {
    return this.http.get<Diagram>(`${this.DIAGRAMS_URL}/${id}/export`);
  }

  /**
   * 8. Importar diagrama desde archivo
   */
  IMPORT(payload: any): Observable<Diagram> {
    return this.http.post<Diagram>(`${this.DIAGRAMS_URL}/import`, payload);
  }
}
