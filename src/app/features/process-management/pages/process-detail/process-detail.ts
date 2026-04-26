import { DiagramService } from '#/app/features/diagram-editor/services/diagram.service';
import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ProcessDiagramViewer } from '../../components/process-diagram-viewer/process-diagram-viewer';
import { AssignmentResponse } from '../../interfaces/process-assignment.model';
import {
  HistoryResponse,
  ProcessInstanceDetailResponse,
  ProcessInstanceSummaryResponse,
} from '../../interfaces/process-instance.model';
import { ProcessInstanceService } from '../../services/process-instance.service';

@Component({
  selector: 'app-process-detail',
  standalone: true,
  imports: [CommonModule, ProcessDiagramViewer],
  templateUrl: './process-detail.html',
})
export class ProcessDetail implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly processInstanceService = inject(ProcessInstanceService);

  private readonly dateFormatter = new Intl.DateTimeFormat('es-BO', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });

  private readonly diagramService = inject(DiagramService);

  public processDetail = signal<ProcessInstanceDetailResponse | null>(null);

  public isLoading = signal(false);
  public errorMessage = signal<string | null>(null);

  public instance = computed<ProcessInstanceSummaryResponse | null>(() => {
    return this.processDetail()?.instance ?? null;
  });

  public activeAssignments = computed<AssignmentResponse[]>(() => {
    return this.processDetail()?.activeAssignments ?? [];
  });

  public history = computed<HistoryResponse[]>(() => {
    return this.processDetail()?.history ?? [];
  });

  public orderedHistory = computed<HistoryResponse[]>(() => {
    return [...this.history()].sort(
      (a, b) => new Date(b.performedAt).getTime() - new Date(a.performedAt).getTime(),
    );
  });

  public completedNodesCount = computed(() => {
    return this.instance()?.completedNodeIds?.length ?? 0;
  });

  public activeNodesCount = computed(() => {
    return this.instance()?.activeNodeIds?.length ?? 0;
  });

  ngOnInit(): void {
    const processInstanceId = this.route.snapshot.paramMap.get('processInstanceId');

    if (!processInstanceId) {
      this.errorMessage.set('No se encontró el identificador del proceso.');
      return;
    }

    this.loadProcessDetail(processInstanceId);
  }

  loadProcessDetail(processInstanceId: string): void {
    this.isLoading.set(true);
    this.errorMessage.set(null);

    this.processInstanceService.GET_BY_ID(processInstanceId, true).subscribe({
      next: (detail) => {
        const diagramId = detail.instance?.diagramId;

        if (!diagramId) {
          this.processDetail.set(detail);
          this.isLoading.set(false);
          return;
        }

        this.diagramService.GET_BY_ID(diagramId).subscribe({
          next: (fullDiagram) => {
            const detailWithFullDiagram: ProcessInstanceDetailResponse = {
              ...detail,
              diagram: fullDiagram,
            };

            console.log('[PROCESS-DETAIL][FULL_DIAGRAM]', fullDiagram);
            console.log('[PROCESS-DETAIL][FULL_DIAGRAM_CELLS]', fullDiagram.cells);

            this.processDetail.set(detailWithFullDiagram);
            this.isLoading.set(false);
          },
          error: (error) => {
            console.error('[PROCESS-DETAIL][LOAD_FULL_DIAGRAM_ERROR]', error);

            this.processDetail.set(detail);
            this.isLoading.set(false);
          },
        });
      },
      error: (error) => {
        console.error('[PROCESS-DETAIL][LOAD_ERROR]', error);
        this.errorMessage.set('No se pudo cargar el detalle del proceso.');
        this.isLoading.set(false);
      },
    });
  }

  refreshDetail(): void {
    const processInstanceId = this.instance()?.id;

    if (!processInstanceId) {
      return;
    }

    this.loadProcessDetail(processInstanceId);
  }

  formatDate(value?: string | null): string {
    if (!value) {
      return 'Sin fecha';
    }

    const parsedDate = new Date(value);

    if (Number.isNaN(parsedDate.getTime())) {
      return 'Sin fecha';
    }

    return this.dateFormatter.format(parsedDate);
  }

  formatStatus(status?: string | null): string {
    switch (status) {
      case 'RUNNING':
        return 'En ejecución';

      case 'PENDING_ASSIGNMENT':
        return 'Pendiente de asignación';

      case 'COMPLETED':
        return 'Completado';

      case 'CANCELLED':
        return 'Cancelado';

      case 'PENDING':
        return 'Pendiente';

      case 'COMPLETED_ASSIGNMENT':
        return 'Completada';

      default:
        return status || 'Sin estado';
    }
  }

  getStatusBadgeClass(status?: string | null): string {
    switch (status) {
      case 'RUNNING':
        return 'bg-green-50 text-green-700';

      case 'PENDING_ASSIGNMENT':
        return 'bg-amber-50 text-amber-700';

      case 'COMPLETED':
        return 'bg-blue-50 text-blue-700';

      case 'CANCELLED':
        return 'bg-red-50 text-red-700';

      case 'PENDING':
        return 'bg-amber-50 text-amber-700';

      default:
        return 'bg-slate-100 text-slate-700';
    }
  }

  getHistoryResponseEntries(history: HistoryResponse): { label: string; value: unknown }[] {
    if (history.templateResponseFields && history.templateResponseFields.length > 0) {
      return history.templateResponseFields.map((field) => ({
        label: field.label || field.fieldId,
        value: field.value,
      }));
    }

    return Object.entries(history.templateResponseData ?? {}).map(([key, value]) => ({
      label: key,
      value,
    }));
  }

  formatHistoryValue(value: unknown): string {
    if (value === null || value === undefined) {
      return '—';
    }

    if (Array.isArray(value)) {
      return value.length > 0 ? value.join(', ') : '—';
    }

    if (typeof value === 'object') {
      return JSON.stringify(value);
    }

    return String(value);
  }

  goBack(): void {
    this.router.navigate(['/process']);
  }
}
