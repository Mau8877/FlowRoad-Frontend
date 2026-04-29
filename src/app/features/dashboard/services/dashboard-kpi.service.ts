import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '#/environments/environment';
import {
  DashboardAiAnalysisResponse,
  DashboardKpiResponse,
} from '../interfaces/dashboard-kpi.model';

@Injectable({
  providedIn: 'root',
})
export class DashboardKpiService {
  private readonly http = inject(HttpClient);

  private readonly URL = `${environment.BASE_URL}`;
  private readonly DASHBOARD_AI_URL = `${environment.AI_BASE_URL}/ai/dashboard`;

  getKpis(): Observable<DashboardKpiResponse> {
    return this.http.get<DashboardKpiResponse>(`${this.URL}/dashboard/kpis`);
  }

  ANALYZE_BOTTLENECK(payload: DashboardKpiResponse): Observable<DashboardAiAnalysisResponse> {
    return this.http.post<DashboardAiAnalysisResponse>(
      `${this.DASHBOARD_AI_URL}/bottleneck-analysis`,
      payload,
    );
  }
}
