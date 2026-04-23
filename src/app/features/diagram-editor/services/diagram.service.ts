import { environment } from '#/environments/environment';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { Diagram, DiagramLane, DiagramSummaryResponse, JoinSessionResponse } from '../interfaces/diagram.models';

@Injectable({
  providedIn: 'root',
})
export class DiagramService {
  private http = inject(HttpClient);

  private readonly DIAGRAMS_URL = `${environment.BASE_URL}/diagrams`;
  private readonly SESSIONS_URL = `${environment.BASE_URL}/design-sessions`;

  GET_ALL_BY_ORGANIZATION(): Observable<DiagramSummaryResponse[]> {
    return this.http.get<DiagramSummaryResponse[]>(this.DIAGRAMS_URL);
  }

  CREATE(): Observable<DiagramSummaryResponse> {
    return this.http.post<DiagramSummaryResponse>(this.DIAGRAMS_URL, {});
  }

  GET_BY_ID(id: string): Observable<Diagram> {
    return this.http.get<Diagram>(`${this.DIAGRAMS_URL}/${id}`);
  }

  UPDATE_METADATA(
    id: string,
    name: string,
    description: string,
  ): Observable<DiagramSummaryResponse> {
    const params = new HttpParams().set('name', name).set('description', description);

    return this.http.put<DiagramSummaryResponse>(`${this.DIAGRAMS_URL}/${id}`, null, { params });
  }

  UPDATE_LANES(id: string, lanes: DiagramLane[]): Observable<Diagram> {
    return this.http.put<Diagram>(`${this.DIAGRAMS_URL}/${id}/lanes`, { lanes });
  }

  TOGGLE_ACTIVE(id: string): Observable<void> {
    return this.http.delete<void>(`${this.DIAGRAMS_URL}/${id}`);
  }

  JOIN_SESSION(diagramId: string): Observable<JoinSessionResponse> {
    return this.http.get<JoinSessionResponse>(`${this.SESSIONS_URL}/join/${diagramId}`);
  }

  CLOSE_SESSION(sessionToken: string, snapshot: string): Observable<void> {
    return this.http.post<void>(`${this.SESSIONS_URL}/${sessionToken}/close`, snapshot, {
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  EXPORT(id: string): Observable<Diagram> {
    return this.http.get<Diagram>(`${this.DIAGRAMS_URL}/${id}/export`);
  }

  IMPORT(payload: any): Observable<Diagram> {
    return this.http.post<Diagram>(`${this.DIAGRAMS_URL}/import`, payload);
  }
}