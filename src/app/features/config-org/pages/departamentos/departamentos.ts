import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Validators } from '@angular/forms';
import { DepartmentService } from '#/app/features/config-org/services/departamento.service';
import { CargoService } from '../../services/cargo.service';
import { AuthService } from '#/app/features/auth/services/auth.service';
import {
  DepartmentResponse,
  CreateDepartmentRequest,
  UpdateDepartmentRequest,
} from '#/app/features/config-org/interfaces/departamentos.model';
import { CommonTable } from '#/app/features/shared/components/common-table/common-table';
import { TableColumn } from '#/app/features/shared/components/common-table/interfaces/column.interface';
import { CreateModal } from '#/app/features/shared/components/common-table/components/create-modal/create-modal';
import { EditModal } from '#/app/features/shared/components/common-table/components/edit-modal/edit-modal';
import { DeleteModal } from '#/app/features/shared/components/common-table/components/delete-modal/delete-modal';
import { FormField } from '#/app/features/shared/components/common-table/interfaces/field.interface';

import {
  LucideAngularModule,
  LUCIDE_ICONS,
  LucideIconProvider,
  Building2,
  Clock,
  Plus,
  Tag,
} from 'lucide-angular';

@Component({
  selector: 'app-departamentos',
  standalone: true,
  imports: [CommonModule, CommonTable, CreateModal, EditModal, DeleteModal, LucideAngularModule],
  templateUrl: './departamentos.html',
  providers: [
    {
      provide: LUCIDE_ICONS,
      multi: true,
      useValue: new LucideIconProvider({ Building2, Clock, Plus, Tag }),
    },
  ],
})
export class Departamentos implements OnInit {
  private deptService = inject(DepartmentService);
  private cargoService = inject(CargoService);
  private authService = inject(AuthService);

  public departamentos = signal<DepartmentResponse[]>([]);
  public cargosDisponibles = signal<{ label: string; value: string }[]>([]);
  public isLoading = signal(false);

  public isCreateModalOpen = signal(false);
  public isEditModalOpen = signal(false);
  public isDeleteModalOpen = signal(false);
  public selectedDept = signal<DepartmentResponse | null>(null);

  public tableColumns: TableColumn[] = [
    { label: 'Departamento', key: 'name', type: 'custom' },
    { label: 'Código', key: 'code' },
    { label: 'SLA (Horas)', key: 'slaHours' },
    { label: 'Estado', key: 'isActive', type: 'badge' },
  ];

  public formFields: FormField[] = [
    {
      name: 'name',
      label: 'Nombre del Departamento',
      type: 'text',
      placeholder: 'Ej. Recursos Humanos',
      gridCols: 2,
      validators: [Validators.required],
    },
    {
      name: 'code',
      label: 'Código (2-5 letras)',
      type: 'text',
      placeholder: 'Ej. RRHH',
      gridCols: 1,
      validators: [Validators.required, Validators.minLength(2), Validators.maxLength(5)],
    },
    {
      name: 'slaHours',
      label: 'SLA de Respuesta (Hrs)',
      type: 'number',
      placeholder: 'Ej. 24',
      gridCols: 1,
      validators: [Validators.required, Validators.min(1)],
    },
    {
      name: 'cargos',
      label: 'Asignar Cargos',
      type: 'multiselect-chips',
      placeholder: 'Selecciona los cargos...',
      gridCols: 2,
      options: [],
      validators: [Validators.required],
    },
  ];

  ngOnInit(): void {
    this.LOAD_DATA();
    this.LOAD_CARGOS();
  }

  LOAD_DATA(): void {
    this.isLoading.set(true);
    this.deptService.GET_BY_ORGANIZATION().subscribe({
      next: (data) => {
        this.departamentos.set(data);
        this.isLoading.set(false);
      },
      error: (err) => {
        console.error('Error en FLOWROAD:', err);
        this.isLoading.set(false);
      },
    });
  }

  LOAD_CARGOS(): void {
    this.cargoService.GET_BY_ORGANIZATION().subscribe({
      next: (data) => {
        const options = data.map((c) => ({ label: c.name, value: c.id }));
        this.cargosDisponibles.set(options);

        const cargosField = this.formFields.find((f) => f.name === 'cargos');
        if (cargosField) cargosField.options = options;
      },
    });
  }

  handleSave(formData: any): void {
    const orgId = this.authService.currentUser()?.orgId;
    if (!orgId) return;

    const request: CreateDepartmentRequest = {
      orgId: orgId,
      name: formData.name,
      code: formData.code.toUpperCase(),
      slaHours: Number(formData.slaHours),
      cargos: formData.cargos,
      managerId: '',
    };

    this.isLoading.set(true);
    this.deptService.CREATE(request).subscribe({
      next: (newDept) => {
        this.departamentos.update((prev) => [newDept, ...prev]);
        this.isLoading.set(false);
        this.isCreateModalOpen.set(false);
      },
      error: () => this.isLoading.set(false),
    });
  }

  handleEdit(dept: DepartmentResponse): void {
    this.selectedDept.set(dept);
    this.isEditModalOpen.set(true);
  }

  handleUpdate(updatedData: any): void {
    const id = updatedData.id;
    const payload: UpdateDepartmentRequest = {
      name: updatedData.name,
      code: updatedData.code?.toUpperCase(),
      slaHours: Number(updatedData.slaHours),
      isActive: updatedData.isActive ?? this.selectedDept()?.isActive,
      cargos: updatedData.cargos,
      managerId: '',
    };

    this.isLoading.set(true);
    this.deptService.UPDATE(id, payload).subscribe({
      next: (response) => {
        this.departamentos.update((list) => list.map((d) => (d.id === id ? response : d)));
        this.isLoading.set(false);
        this.isEditModalOpen.set(false);
      },
      error: () => this.isLoading.set(false),
    });
  }

  handleDelete(dept: DepartmentResponse): void {
    this.selectedDept.set(dept);
    this.isDeleteModalOpen.set(true);
  }

  confirmDelete(): void {
    const dept = this.selectedDept();
    if (!dept) return;

    this.isLoading.set(true);
    this.deptService.DELETE(dept.id).subscribe({
      next: () => {
        this.departamentos.update((list) =>
          list.map((d) => (d.id === dept.id ? { ...d, isActive: false } : d)),
        );
        this.isLoading.set(false);
        this.isDeleteModalOpen.set(false);
      },
      error: (err) => {
        console.error('Error al eliminar departamento:', err);
        this.isLoading.set(false);
      },
    });
  }
}
