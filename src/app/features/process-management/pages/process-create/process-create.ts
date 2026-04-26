import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';

import { DiagramSummaryResponse } from '#/app/features/diagram-editor/interfaces/diagram.models';
import { DiagramService } from '#/app/features/diagram-editor/services/diagram.service';

import { CreateModal } from '#/app/features/shared/components/common-table/components/create-modal/create-modal';
import { FormField } from '#/app/features/shared/components/common-table/interfaces/field.interface';

import {
  CreateProcessInstanceRequest,
  ProcessInstanceSummaryResponse,
} from '../../interfaces/process-instance.model';
import { ProcessInstanceService } from '../../services/process-instance.service';

import {
  ClipboardList,
  LUCIDE_ICONS,
  LucideAngularModule,
  LucideIconProvider,
  Plus,
} from 'lucide-angular';

@Component({
  selector: 'app-process-create',
  standalone: true,
  imports: [CommonModule, RouterLink, CreateModal, LucideAngularModule],
  templateUrl: './process-create.html',
  providers: [
    {
      provide: LUCIDE_ICONS,
      multi: true,
      useValue: new LucideIconProvider({
        ClipboardList,
        Plus,
      }),
    },
  ],
})
export class ProcessCreate implements OnInit {
  private readonly diagramService = inject(DiagramService);
  private readonly processInstanceService = inject(ProcessInstanceService);
  private readonly router = inject(Router);
  private readonly dateFormatter = new Intl.DateTimeFormat('es-BO', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });

  public diagrams = signal<DiagramSummaryResponse[]>([]);
  public processInstances = signal<ProcessInstanceSummaryResponse[]>([]);

  public isLoading = signal(false);
  public isCreateModalOpen = signal(false);

  public formFields: FormField[] = [
    {
      name: 'diagramId',
      label: 'Trámite / diagrama ejecutable',
      type: 'select',
      placeholder: 'Selecciona el trámite que corresponde',
      gridCols: 2,
      options: [],
      validators: [Validators.required],
    },
  ];

  ngOnInit(): void {
    this.LOAD_DATA();
  }

  LOAD_DATA(): void {
    this.isLoading.set(true);

    this.processInstanceService.GET_ALL().subscribe({
      next: (processes) => {
        this.processInstances.set(processes);
        this.LOAD_DIAGRAMS();
      },
      error: (error) => {
        console.error('[PROCESS-CREATE][LOAD_PROCESSES_ERROR]', error);
        this.isLoading.set(false);
      },
    });
  }

  LOAD_DIAGRAMS(): void {
    this.diagramService.GET_ALL_BY_ORGANIZATION().subscribe({
      next: (data) => {
        this.diagrams.set(data);

        const diagramOptions = data
          .filter((diagram) => diagram.isActive)
          .map((diagram) => ({
            label: `${diagram.name} · v${diagram.version}`,
            value: diagram.id,
          }));

        const diagramField = this.formFields.find((field) => field.name === 'diagramId');

        if (diagramField) {
          diagramField.options = diagramOptions;
        }

        this.isLoading.set(false);
      },
      error: (error) => {
        console.error('[PROCESS-CREATE][LOAD_DIAGRAMS_ERROR]', error);
        this.isLoading.set(false);
      },
    });
  }

  handleSave(formData: any): void {
    if (!formData?.diagramId) {
      return;
    }

    const selectedDiagram = this.diagrams().find((diagram) => diagram.id === formData.diagramId);

    const request: CreateProcessInstanceRequest = {
      diagramId: formData.diagramId,
      requestData: {
        selectedDiagramName: selectedDiagram?.name ?? null,
        selectedDiagramVersion: selectedDiagram?.version ?? null,
      },
    };

    this.isLoading.set(true);

    this.processInstanceService.CREATE(request).subscribe({
      next: (createdProcess) => {
        this.processInstances.update((current) => [createdProcess, ...current]);
        this.isLoading.set(false);
        this.isCreateModalOpen.set(false);
      },
      error: (error) => {
        console.error('[PROCESS-CREATE][CREATE_PROCESS_ERROR]', error);
        this.isLoading.set(false);
      },
    });
  }

  goBack(): void {
    this.router.navigate(['/process']);
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

  formatStatus(status: string): string {
    switch (status) {
      case 'RUNNING':
        return 'En ejecución';
      case 'PENDING_ASSIGNMENT':
        return 'Pendiente de asignación';
      case 'COMPLETED':
        return 'Completado';
      case 'CANCELLED':
        return 'Cancelado';
      default:
        return status || 'Sin estado';
    }
  }

  getStatusBadgeClass(status: string): string {
    switch (status) {
      case 'RUNNING':
        return 'bg-green-50 text-green-700 border-green-200';
      case 'PENDING_ASSIGNMENT':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'COMPLETED':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'CANCELLED':
        return 'bg-red-50 text-red-700 border-red-200';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  }

  getDiagramName(process: ProcessInstanceSummaryResponse): string {
    return process.diagramName?.trim() || 'Proceso sin diagrama';
  }

  getStartedBy(process: ProcessInstanceSummaryResponse): string {
    return process.startedByUserName?.trim() || 'Usuario no disponible';
  }
}
