import { environment } from '#/environments/environment';
import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { WorkerAiRequest, WorkerAiResponse } from '../interfaces/worker-ai.model';

@Injectable({
  providedIn: 'root',
})
export class WorkerAiService {
  private readonly http = inject(HttpClient);
  private readonly WORKER_AI_URL = `${environment.AI_BASE_URL}/ai/worker`;

  TEMPLATE_ASSIST(payload: WorkerAiRequest): Observable<WorkerAiResponse> {
    return this.http.post<WorkerAiResponse>(`${this.WORKER_AI_URL}/template-assist`, payload);
  }

  FILL_TEMPLATE(payload: WorkerAiRequest): Observable<WorkerAiResponse> {
    return this.http.post<WorkerAiResponse>(`${this.WORKER_AI_URL}/fill-template`, payload);
  }
}
