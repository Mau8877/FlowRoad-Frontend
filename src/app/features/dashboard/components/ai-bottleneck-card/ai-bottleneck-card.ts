import { Component, input } from '@angular/core';

import {
  DashboardAiAnalysisResponse,
  DashboardAiSeverity,
} from '../../interfaces/dashboard-kpi.model';

@Component({
  selector: 'app-ai-bottleneck-card',
  standalone: true,
  templateUrl: './ai-bottleneck-card.html',
  styleUrl: './ai-bottleneck-card.css',
})
export class AiBottleneckCardComponent {
  readonly analysis = input<DashboardAiAnalysisResponse | null>(null);
  readonly isLoading = input(false);
  readonly errorMessage = input<string | null>(null);

  getSeverityClass(severity: DashboardAiSeverity | undefined): string {
    switch (severity) {
      case 'HIGH':
        return 'severity-high';
      case 'MEDIUM':
        return 'severity-medium';
      case 'LOW':
      default:
        return 'severity-low';
    }
  }

  getSeverityLabel(value: string | undefined): string {
    switch (value) {
      case 'HIGH':
        return 'Riesgo alto';
      case 'MEDIUM':
        return 'Riesgo medio';
      case 'LOW':
      default:
        return 'Riesgo bajo';
    }
  }

  getGeneratedByLabel(value: string | undefined): string {
    if (value === 'AI') {
      return 'Generado por IA';
    }

    return 'Análisis local';
  }

  formatGeneratedAt(value: string | null | undefined): string {
    if (!value) {
      return 'Sin fecha';
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return 'Sin fecha';
    }

    return new Intl.DateTimeFormat('es-BO', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  }
}
