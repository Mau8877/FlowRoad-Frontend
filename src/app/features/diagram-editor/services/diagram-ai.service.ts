import { environment } from '#/environments/environment';
import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { DiagramAiRequest, DiagramAiResponse } from '../interfaces/diagram.models';

@Injectable({
  providedIn: 'root',
})
export class DiagramAiService {
  private readonly http = inject(HttpClient);
  private readonly AI_URL = `${environment.AI_BASE_URL}/ai/diagram`;

  MESSAGE(payload: DiagramAiRequest): Observable<DiagramAiResponse> {
    return this.http.post<DiagramAiResponse>(`${this.AI_URL}/message`, payload);
  }
}
