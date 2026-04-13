import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Validators } from '@angular/forms';

// Services
import { UserService } from './services/users.service';
import { DepartmentService } from '#/app/features/config-org/services/departamento.service';
import { AuthService } from '#/app/features/auth/services/auth.service';

// Interfaces
import {
  UserResponse,
  RegisterWorkerRequest,
  UpdateUserRequest,
  Roles,
} from './interfaces/users.model';
import { DepartmentResponse } from '#/app/features/config-org/interfaces/departamentos.model';

// Shared
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
  UserPlus,
  Mail,
  ShieldCheck,
  Briefcase,
} from 'lucide-angular';

@Component({
  selector: 'app-users',
  standalone: true,
  imports: [CommonModule, CommonTable, CreateModal, EditModal, DeleteModal, LucideAngularModule],
  templateUrl: './users.html',
  providers: [
    {
      provide: LUCIDE_ICONS,
      multi: true,
      useValue: new LucideIconProvider({
        Users,
        UserPlus,
        Mail,
        ShieldCheck,
        Briefcase,
      }),
    },
  ],
})
export class UsersComponent implements OnInit {
  private userService = inject(UserService);
  private deptService = inject(DepartmentService);
  private authService = inject(AuthService);

  public users = signal<UserResponse[]>([]);
  public departamentosRaw = signal<DepartmentResponse[]>([]);
  public isLoading = signal(false);

  // Modales
  public isCreateModalOpen = signal(false);
  public isEditModalOpen = signal(false);
  public isDeleteModalOpen = signal(false);
  public selectedUser = signal<UserResponse | null>(null);

  public tableColumns: TableColumn[] = [
    { label: 'Usuario', key: 'profile.nombre', type: 'custom' },
    { label: 'Rol', key: 'role', type: 'text' },
    { label: 'Departamento', key: 'deptName' },
    { label: 'Cargo', key: 'cargoName' },
    { label: 'Estado', key: 'isActive', type: 'badge' },
  ];

  public formFields: FormField[] = [
    {
      name: 'nombre',
      label: 'Nombre',
      type: 'text',
      gridCols: 1,
      validators: [Validators.required],
    },
    {
      name: 'apellido',
      label: 'Apellido',
      type: 'text',
      gridCols: 1,
      validators: [Validators.required],
    },
    {
      name: 'email',
      label: 'Correo Electrónico',
      type: 'text',
      gridCols: 2,
      validators: [Validators.required, Validators.email],
    },
    {
      name: 'password',
      label: 'Contraseña Temporal',
      type: 'text',
      gridCols: 2,
      validators: [Validators.required, Validators.minLength(6)],
    },
    {
      name: 'role',
      label: 'Rol en la Organización',
      type: 'select',
      gridCols: 2,
      options: [
        { label: 'Administrador', value: Roles.ADMIN },
        { label: 'Trabajador Operativo', value: Roles.WORKER },
        { label: 'Diseñador de Procesos', value: Roles.DESIGNER },
        { label: 'Recepcionista', value: Roles.RECEP },
      ],
      validators: [Validators.required],
    },
    {
      name: 'departmentId',
      label: 'Departamento',
      type: 'select',
      gridCols: 1,
      options: [],
      validators: [Validators.required],
    },
    {
      name: 'cargoId',
      label: 'Cargo',
      type: 'select',
      gridCols: 1,
      options: [],
      validators: [Validators.required],
    },
    { name: 'telefono', label: 'Teléfono', type: 'text', gridCols: 1 },
    { name: 'direccion', label: 'Dirección', type: 'text', gridCols: 1 },
  ];

  ngOnInit(): void {
    this.LOAD_DATA();
    this.LOAD_DEPTS_AND_CARGOS();
  }

  LOAD_DATA(): void {
    this.isLoading.set(true);
    this.userService.GET_BY_ORGANIZATION().subscribe({
      next: (data) => {
        // Aplanamos solo lo necesario para la visualización de la tabla
        const mappedData = data.map((user) => ({
          ...user,
          deptName: user.department?.name || '---',
          cargoName: user.cargo?.name || '---',
        }));

        this.users.set(mappedData as any);
        this.isLoading.set(false);
      },
      error: () => this.isLoading.set(false),
    });
  }

  LOAD_DEPTS_AND_CARGOS(): void {
    this.deptService.GET_BY_ORGANIZATION().subscribe({
      next: (data) => {
        this.departamentosRaw.set(data);
        const deptField = this.formFields.find((f) => f.name === 'departmentId');
        if (deptField) {
          deptField.options = data.map((d) => ({ label: d.name, value: d.id }));
        }
      },
    });
  }

  /**
   * Esta función es la que hace la magia de la "Versión 2"
   * Filtra los cargos basándose en el departamento elegido
   */
  onDepartmentChange(deptId: string): void {
    const selectedDept = this.departamentosRaw().find((d) => d.id === deptId);
    const cargoField = this.formFields.find((f) => f.name === 'cargoId');

    if (cargoField) {
      if (selectedDept) {
        cargoField.options = selectedDept.cargos.map((c) => ({ label: c.name, value: c.id }));
      } else {
        cargoField.options = [];
      }
    }
  }

  handleSave(formData: any): void {
    const orgId = this.authService.currentUser()?.orgId;
    if (!orgId) return;

    const request: RegisterWorkerRequest = {
      email: formData.email,
      password: formData.password,
      role: formData.role,
      orgId: orgId,
      departmentId: formData.departmentId,
      cargoId: formData.cargoId,
      profile: {
        nombre: formData.nombre,
        apellido: formData.apellido,
        telefono: formData.telefono,
        direccion: formData.direccion,
      },
    };

    this.isLoading.set(true);
    this.userService.CREATE(request).subscribe({
      next: () => {
        this.LOAD_DATA();
        this.isCreateModalOpen.set(false);
      },
      error: () => this.isLoading.set(false),
    });
  }

  handleEdit(user: UserResponse): void {
    // 1. Creamos el objeto aplanado para que el formulario del modal lo reconozca
    const aplanado = {
      ...user,
      nombre: user.profile?.nombre || '',
      apellido: user.profile?.apellido || '',
      telefono: user.profile?.telefono || '',
      direccion: user.profile?.direccion || '',
      departmentId: user.department?.id || '',
      cargoId: user.cargo?.id || '',
    };

    // 2. Guardamos este objeto en la señal de usuario seleccionado
    this.selectedUser.set(aplanado as any);

    // 3. Filtramos los cargos para que el modal ya aparezca con las opciones correctas
    this.onDepartmentChange(user.department.id);

    // 4. AHORA SÍ: Abrimos el modal pasando un simple TRUE
    this.isEditModalOpen.set(true);
  }

  handleUpdate(updatedData: any): void {
    const id = this.selectedUser()?.id;
    if (!id) return;

    const payload: UpdateUserRequest = {
      profile: {
        nombre: updatedData.nombre,
        apellido: updatedData.apellido,
        telefono: updatedData.telefono,
        direccion: updatedData.direccion,
      },
      departmentId: updatedData.departmentId,
      cargoId: updatedData.cargoId,
      isActive: updatedData.isActive,
    };

    this.isLoading.set(true);
    this.userService.UPDATE(id, payload).subscribe({
      next: () => {
        this.LOAD_DATA();
        this.isEditModalOpen.set(false);
      },
      error: () => this.isLoading.set(false),
    });
  }

  handleDelete(user: UserResponse): void {
    this.selectedUser.set(user);
    this.isDeleteModalOpen.set(true);
  }

  confirmDelete(): void {
    const id = this.selectedUser()?.id;
    if (!id) return;

    this.isLoading.set(true);
    this.userService.DELETE(id).subscribe({
      next: () => {
        this.LOAD_DATA();
        this.isDeleteModalOpen.set(false);
      },
      error: () => this.isLoading.set(false),
    });
  }
}
