import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '#/environments/environment';
import { DeepLearningCurrentPredictionsResponse } from '../models/deep-learning-analytics.model';

@Injectable({
  providedIn: 'root',
})
export class DeepLearningAnalyticsService {
  private readonly http = inject(HttpClient);
  private readonly URL = `${environment.BASE_URL}`;

  getCurrentPredictions(limit: number = 200): Observable<DeepLearningCurrentPredictionsResponse> {
    return this.http.get<DeepLearningCurrentPredictionsResponse>(
      `${this.URL}/analytics/deep-learning/predictions/current?limit=${limit}`
    );
  }
}
