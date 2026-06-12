import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { environment } from '#/environments/environment';
import {
  GeneratedReportHistoryResponse,
  GeneratedReportHistoryPageResponse,
  ReportExportFormat,
  ReportPreviewResponse,
  ReportSuggestionsResponse,
} from '../interfaces/intelligent-report.model';

@Injectable({ providedIn: 'root' })
export class IntelligentReportService {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.BASE_URL}/reports/intelligent`;

  preview(prompt: string) {
    return this.http.post<ReportPreviewResponse>(`${this.url}/preview`, { prompt });
  }

  history() {
    return this.http.get<GeneratedReportHistoryResponse[]>(`${this.url}/history`);
  }

  historyPage(page: number, size: number) {
    return this.http.get<GeneratedReportHistoryPageResponse>(`${this.url}/history/page`, {
      params: { page, size },
    });
  }

  suggestions() {
    return this.http.get<ReportSuggestionsResponse>(`${this.url}/suggestions`);
  }

  export(prompt: string, format: ReportExportFormat) {
    return this.http.post(`${this.url}/export`, { prompt, format }, { responseType: 'blob' });
  }
}
