import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { Validators } from '@angular/forms';
import { Router } from '@angular/router';

import { DepartmentService } from '#/app/features/config-org/services/departamento.service';
import {
  CreateTemplateRequest,
  TemplateResponse,
  UpdateTemplateRequest,
} from '../../interfaces/plantillas.models';
import { TemplateService } from '../../services/plantillas.service';

import { CommonTable } from '#/app/features/shared/components/common-table/common-table';
import { CreateModal } from '#/app/features/shared/components/common-table/components/create-modal/create-modal';
import { DeleteModal } from '#/app/features/shared/components/common-table/components/delete-modal/delete-modal';
import { EditModal } from '#/app/features/shared/components/common-table/components/edit-modal/edit-modal';
import { TableColumn } from '#/app/features/shared/components/common-table/interfaces/column.interface';
import { FormField } from '#/app/features/shared/components/common-table/interfaces/field.interface';

import {
  FileJson,
  LUCIDE_ICONS,
  Layers,
  LucideAngularModule,
  LucideIconProvider,
  Plus,
  Settings2,
  Trash2,
} from 'lucide-angular';

@Component({
  selector: 'app-plantillas',
  standalone: true,
  imports: [CommonModule, CommonTable, CreateModal, EditModal, DeleteModal, LucideAngularModule],
  templateUrl: './plantillas.html',
  providers: [
    {
      provide: LUCIDE_ICONS,
      multi: true,
      useValue: new LucideIconProvider({ Plus, Settings2, Trash2, Layers, FileJson }),
    },
  ],
})
export class Plantillas implements OnInit {
  private templateService = inject(TemplateService);
  private deptService = inject(DepartmentService);
  private router = inject(Router);

  public plantillas = signal<TemplateResponse[]>([]);
  public departamentosOptions = signal<{ label: string; value: string }[]>([]);
  public isLoading = signal(false);

  // Modales
  public isCreateModalOpen = signal(false);
  public isEditModalOpen = signal(false);
  public isDeleteModalOpen = signal(false);
  public selectedTemplate = signal<TemplateResponse | null>(null);

  // Configuración de Columnas (El ID se queda como columna normal)
  public tableColumns: TableColumn[] = [
    { label: 'ID', key: 'id' },
    { label: 'Nombre del Formulario', key: 'name', type: 'custom' }, // Solo el nombre es custom
    { label: 'Departamento', key: 'departmentName' },
    { label: 'Versión', key: 'version' },
    { label: 'Estado', key: 'isActive', type: 'badge' },
  ];

  // Campos para Modales
  public formFields: FormField[] = [
    {
      name: 'name',
      label: 'Nombre de la Plantilla',
      type: 'text',
      placeholder: 'Ej. Inspección de Frenos',
      gridCols: 2,
      validators: [Validators.required],
    },
    {
      name: 'description',
      label: 'Descripción',
      type: 'textarea',
      placeholder: 'Describe el propósito de este formulario...',
      gridCols: 2,
      validators: [Validators.required],
    },
    {
      name: 'departmentId',
      label: 'Departamento Responsable',
      type: 'select',
      placeholder: 'Selecciona departamento...',
      gridCols: 2,
      options: [],
      validators: [Validators.required],
    },
  ];

  ngOnInit(): void {
    this.isLoading.set(true);

    // 1. Cargamos departamentos PRIMERO para que no haya desincronización
    this.deptService.GET_BY_ORGANIZATION().subscribe({
      next: (deps) => {
        const options = deps.map((d) => ({ label: d.name, value: d.id }));
        this.departamentosOptions.set(options);

        const deptField = this.formFields.find((f) => f.name === 'departmentId');
        if (deptField) deptField.options = options;

        // 2. Cargamos las plantillas una vez que los departamentos están listos
        this.LOAD_DATA();
      },
      error: () => this.isLoading.set(false),
    });
  }

  // Se eliminó la función duplicada LOAD_DEPARTMENTS para mantenerlo limpio
  LOAD_DATA(): void {
    this.templateService.GET_ALL_BY_ORGANIZATION().subscribe({
      next: (data) => {
        this.plantillas.set(data);
        this.isLoading.set(false);
      },
      error: () => this.isLoading.set(false),
    });
  }

  handleSave(formData: any): void {
    const request: CreateTemplateRequest = {
      name: formData.name,
      description: formData.description,
      departmentId: formData.departmentId,
      fields: [],
    };

    this.isLoading.set(true);
    this.templateService.CREATE(request).subscribe({
      next: (newTemplate) => {
        this.isLoading.set(false);
        this.isCreateModalOpen.set(false);
        this.router.navigate(['/config/plantillas/edit', newTemplate.id]);
      },
      error: () => this.isLoading.set(false),
    });
  }

  goToCreate(): void {
    this.router.navigate(['/config/plantillas/create']);
  }

  goToEdit(template: TemplateResponse): void {
    this.router.navigate(['/config/plantillas/edit', template.id]);
  }

  handleEdit(template: TemplateResponse): void {
    this.selectedTemplate.set(template);
    this.isEditModalOpen.set(true);
  }

  handleUpdate(updatedData: any): void {
    const id = this.selectedTemplate()?.id;
    if (!id) return;

    const payload: UpdateTemplateRequest = {
      name: updatedData.name,
      description: updatedData.description,
      departmentId: updatedData.departmentId,
      isActive: updatedData.isActive,
    };

    this.isLoading.set(true);
    this.templateService.UPDATE(id, payload).subscribe({
      next: (response) => {
        this.plantillas.update((list) => list.map((t) => (t.id === id ? response : t)));
        this.isLoading.set(false);
        this.isEditModalOpen.set(false);
      },
      error: () => this.isLoading.set(false),
    });
  }

  handleDelete(template: TemplateResponse): void {
    this.selectedTemplate.set(template);
    this.isDeleteModalOpen.set(true);
  }

  confirmDelete(): void {
    const template = this.selectedTemplate();
    if (!template) return;

    this.isLoading.set(true);
    this.templateService.DELETE(template.id).subscribe({
      next: () => {
        this.plantillas.update((list) =>
          list.map((t) => (t.id === template.id ? { ...t, isActive: false } : t)),
        );
        this.isLoading.set(false);
        this.isDeleteModalOpen.set(false);
      },
      error: () => this.isLoading.set(false),
    });
  }
}
