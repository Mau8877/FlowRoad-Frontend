import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Validators } from '@angular/forms';
import { CargoService } from '../../services/cargo.service';
import { AuthService } from '#/app/features/auth/services/auth.service';
import {
  CargoResponse,
  CreateCargoRequest,
  UpdateCargoRequest,
} from '../../interfaces/cargo.model';
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
  Users,
  Briefcase,
  Plus,
} from 'lucide-angular';

@Component({
  selector: 'app-cargos',
  standalone: true,
  imports: [CommonModule, CommonTable, CreateModal, EditModal, DeleteModal, LucideAngularModule],
  templateUrl: './cargos.html',
  providers: [
    {
      provide: LUCIDE_ICONS,
      multi: true,
      useValue: new LucideIconProvider({ Users, Briefcase, Plus }),
    },
  ],
})
export class Cargos implements OnInit {
  private cargoService = inject(CargoService);
  private authService = inject(AuthService);

  public cargos = signal<CargoResponse[]>([]);
  public isLoading = signal(false);

  public isCreateModalOpen = signal(false);
  public isEditModalOpen = signal(false);
  public isDeleteModalOpen = signal(false);
  public selectedCargo = signal<CargoResponse | null>(null);

  public tableColumns: TableColumn[] = [
    { label: 'Información del Cargo', key: 'name', type: 'custom' },
    { label: 'Nivel Jerárquico', key: 'level' },
    { label: 'Estado', key: 'isActive', type: 'badge' },
  ];

  public formFields: FormField[] = [
    {
      name: 'name',
      label: 'Nombre del Cargo',
      type: 'text',
      placeholder: 'Ej. Gerente de Ventas',
      gridCols: 2,
      validators: [Validators.required],
    },
    {
      name: 'level',
      label: 'Nivel Jerárquico',
      type: 'number',
      placeholder: '1-10',
      gridCols: 1,
      validators: [Validators.required, Validators.min(1)],
    },
  ];

  ngOnInit(): void {
    this.LOAD_DATA();
  }

  LOAD_DATA(): void {
    this.isLoading.set(true);
    this.cargoService.GET_BY_ORGANIZATION().subscribe({
      next: (data) => {
        this.cargos.set(data);
        this.isLoading.set(false);
      },
      error: (err) => {
        console.error('Error en FLOWROAD:', err);
        this.isLoading.set(false);
      },
    });
  }

  handleSave(formData: any): void {
    const orgId = this.authService.currentUser()?.orgId;
    if (!orgId) return;

    const request: CreateCargoRequest = {
      orgId: orgId,
      name: formData.name,
      level: Number(formData.level),
    };

    this.isLoading.set(true);
    this.cargoService.CREATE(request).subscribe({
      next: (newCargo) => {
        this.cargos.update((prev) => [newCargo, ...prev]);
        this.isLoading.set(false);
        this.isCreateModalOpen.set(false);
      },
      error: () => this.isLoading.set(false),
    });
  }

  handleEdit(cargo: CargoResponse): void {
    this.selectedCargo.set(cargo);
    this.isEditModalOpen.set(true);
  }

  handleUpdate(updatedData: any): void {
    const id = updatedData.id;
    const payload: UpdateCargoRequest = {
      name: updatedData.name,
      level: Number(updatedData.level),
      isActive: updatedData.isActive ?? this.selectedCargo()?.isActive,
    };

    this.isLoading.set(true);
    this.cargoService.UPDATE(id, payload).subscribe({
      next: (response) => {
        this.cargos.update((list) => list.map((c) => (c.id === id ? response : c)));
        this.isLoading.set(false);
        this.isEditModalOpen.set(false);
      },
      error: () => this.isLoading.set(false),
    });
  }

  handleDelete(cargo: CargoResponse): void {
    this.selectedCargo.set(cargo);
    this.isDeleteModalOpen.set(true);
  }

  /**
   * Ejecuta el DELETE lógico
   */
  confirmDelete(): void {
    const cargo = this.selectedCargo();
    if (!cargo) return;

    this.isLoading.set(true);

    this.cargoService.DELETE(cargo.id).subscribe({
      next: () => {
        this.cargos.update((list) =>
          list.map((c) => (c.id === cargo.id ? { ...c, isActive: false } : c)),
        );

        this.isLoading.set(false);
        this.isDeleteModalOpen.set(false);
      },
      error: (err) => {
        console.error('Error al eliminar cargo:', err);
        this.isLoading.set(false);
      },
    });
  }
}
