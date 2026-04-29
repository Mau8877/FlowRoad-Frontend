import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { finalize } from 'rxjs';

import { AiBottleneckCardComponent } from './components/ai-bottleneck-card/ai-bottleneck-card';
import { DepartmentPendingCardComponent } from './components/department-pending-card/department-pending-card';
import { KpiCardComponent } from './components/kpi-card/kpi-card';
import { StatusDonutChartComponent } from './components/status-donut-chart/status-donut-chart';
import { TopProcessesChartComponent } from './components/top-processes-chart/top-processes-chart';
import {
  DashboardAiAnalysisResponse,
  DashboardKpiResponse,
} from './interfaces/dashboard-kpi.model';
import { DashboardKpiService } from './services/dashboard-kpi.service';

interface DashboardCardData {
  title: string;
  value: string | number;
  helper: string;
  description: string;
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    KpiCardComponent,
    StatusDonutChartComponent,
    TopProcessesChartComponent,
    DepartmentPendingCardComponent,
    AiBottleneckCardComponent,
  ],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css',
})
export class Dashboard implements OnInit {
  private readonly dashboardKpiService = inject(DashboardKpiService);

  readonly kpis = signal<DashboardKpiResponse | null>(null);
  readonly aiAnalysis = signal<DashboardAiAnalysisResponse | null>(null);

  readonly isLoading = signal(false);
  readonly isAiLoading = signal(false);

  readonly errorMessage = signal<string | null>(null);
  readonly aiErrorMessage = signal<string | null>(null);

  readonly kpiCards = computed<DashboardCardData[]>(() => {
    const data = this.kpis();

    if (!data) {
      return [];
    }

    return [
      {
        title: 'Total de trámites',
        value: data.totalProcesses,
        helper: 'Iniciados',
        description: 'Instancias de proceso creadas en la organización.',
      },
      {
        title: 'Finalización',
        value: `${data.completionRate}%`,
        helper: `${data.completedProcesses} completados`,
        description: 'Porcentaje de trámites finalizados correctamente.',
      },
      {
        title: 'Tiempo promedio',
        value: data.averageCompletionTimeLabel,
        helper: `${data.averageCompletionTimeMinutes} min`,
        description: 'Promedio calculado con trámites completados.',
      },
      {
        title: 'Pendientes de asignación',
        value: data.pendingAssignmentProcesses,
        helper: 'Procesos',
        description: 'Trámites que requieren asignación operativa.',
      },
    ];
  });

  ngOnInit(): void {
    this.loadKpis();
  }

  loadKpis(): void {
    this.isLoading.set(true);
    this.errorMessage.set(null);
    this.aiErrorMessage.set(null);
    this.aiAnalysis.set(null);

    this.dashboardKpiService
      .getKpis()
      .pipe(finalize(() => this.isLoading.set(false)))
      .subscribe({
        next: (response) => {
          this.kpis.set(response);
          this.loadAiAnalysis(response);
        },
        error: (error) => {
          this.errorMessage.set(this.resolveErrorMessage(error));
        },
      });
  }

  loadAiAnalysis(kpis: DashboardKpiResponse): void {
    this.isAiLoading.set(true);
    this.aiErrorMessage.set(null);

    this.dashboardKpiService
      .ANALYZE_BOTTLENECK(kpis)
      .pipe(finalize(() => this.isAiLoading.set(false)))
      .subscribe({
        next: (response) => {
          this.aiAnalysis.set(response);
        },
        error: (error) => {
          this.aiErrorMessage.set(this.resolveErrorMessage(error));
        },
      });
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

  trackCard(_index: number, item: DashboardCardData): string {
    return item.title;
  }

  private resolveErrorMessage(error: unknown): string {
    if (
      typeof error === 'object' &&
      error !== null &&
      'error' in error &&
      typeof error.error === 'object' &&
      error.error !== null &&
      'message' in error.error
    ) {
      return String(error.error.message);
    }

    if (typeof error === 'object' && error !== null && 'message' in error) {
      return String(error.message);
    }

    return 'No se pudo completar la operación solicitada.';
  }
}
