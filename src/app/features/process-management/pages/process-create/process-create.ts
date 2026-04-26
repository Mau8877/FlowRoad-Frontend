import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { Validators } from '@angular/forms';
import { Router } from '@angular/router';

import { DiagramSummaryResponse } from '#/app/features/diagram-editor/interfaces/diagram.models';
import { DiagramService } from '#/app/features/diagram-editor/services/diagram.service';

import { CommonTable } from '#/app/features/shared/components/common-table/common-table';
import { CreateModal } from '#/app/features/shared/components/common-table/components/create-modal/create-modal';
import { TableColumn } from '#/app/features/shared/components/common-table/interfaces/column.interface';
import { FormField } from '#/app/features/shared/components/common-table/interfaces/field.interface';

import {
  CreateProcessInstanceRequest,
  ProcessInstanceSummaryResponse,
} from '../../interfaces/process-instance.model';
import { ProcessInstanceService } from '../../services/process-instance.service';

import {
  ClipboardList,
  FileText,
  LUCIDE_ICONS,
  LucideAngularModule,
  LucideIconProvider,
  Plus,
  Workflow,
} from 'lucide-angular';

@Component({
  selector: 'app-process-create',
  standalone: true,
  imports: [CommonModule, CommonTable, CreateModal, LucideAngularModule],
  templateUrl: './process-create.html',
  providers: [
    {
      provide: LUCIDE_ICONS,
      multi: true,
      useValue: new LucideIconProvider({
        ClipboardList,
        FileText,
        Plus,
        Workflow,
      }),
    },
  ],
})
export class ProcessCreate implements OnInit {
  private readonly diagramService = inject(DiagramService);
  private readonly processInstanceService = inject(ProcessInstanceService);
  private readonly router = inject(Router);

  public diagrams = signal<DiagramSummaryResponse[]>([]);
  public processInstances = signal<ProcessInstanceSummaryResponse[]>([]);

  public isLoading = signal(false);
  public isCreateModalOpen = signal(false);

  public tableColumns: TableColumn[] = [
    { label: 'Proceso', key: 'code', type: 'custom' },
    { label: 'Trámite / Diagrama', key: 'diagramName' },
    { label: 'Estado', key: 'status', type: 'badge' },
    { label: 'Iniciado por', key: 'startedByUserName' },
    { label: 'Fecha de inicio', key: 'startedAt' },
    { label: 'Última actualización', key: 'updatedAt' },
  ];

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
}
