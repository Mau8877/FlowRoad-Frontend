import { AuthService } from '#/app/features/auth/services/auth.service';
import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { DiagramSummaryResponse } from '../../interfaces/diagram.models';
import { DiagramService } from '../../services/diagram.service';

import { CommonTable } from '#/app/features/shared/components/common-table/common-table';
import { DeleteModal } from '#/app/features/shared/components/common-table/components/delete-modal/delete-modal';
import { TableColumn } from '#/app/features/shared/components/common-table/interfaces/column.interface';

import {
  Activity,
  Clock,
  FileCode,
  LUCIDE_ICONS,
  Layout,
  LucideAngularModule,
  LucideIconProvider,
  Plus,
} from 'lucide-angular';

@Component({
  selector: 'app-gestion-diagramas',
  standalone: true,
  imports: [CommonModule, CommonTable, DeleteModal, LucideAngularModule], // Quitamos CreateModal
  templateUrl: './gestion-diagramas.html',
  providers: [
    {
      provide: LUCIDE_ICONS,
      multi: true,
      useValue: new LucideIconProvider({ Layout, Clock, Plus, FileCode, Activity }),
    },
  ],
})
export class GestionDiagramas implements OnInit {
  private diagramService = inject(DiagramService);
  private authService = inject(AuthService);
  private router = inject(Router);

  public diagramas = signal<DiagramSummaryResponse[]>([]);
  public isLoading = signal(false);
  public isDeleteModalOpen = signal(false);
  public selectedDiagram = signal<DiagramSummaryResponse | null>(null);

  public tableColumns: TableColumn[] = [
    { label: 'Diagrama', key: 'name', type: 'custom' },
    { label: 'Versión', key: 'version' },
    { label: 'Última Modificación', key: 'updatedAt', type: 'date' },
    { label: 'Estado', key: 'isActive', type: 'badge' },
  ];

  ngOnInit(): void {
    this.LOAD_DATA();
  }

  LOAD_DATA(): void {
    this.isLoading.set(true);
    this.diagramService.GET_ALL_BY_ORGANIZATION().subscribe({
      next: (data) => {
        this.diagramas.set(data);
        this.isLoading.set(false);
      },
      error: () => this.isLoading.set(false),
    });
  }

  /**
   * PASO A PASO AL CREAR:
   * Creamos un registro rápido en BD y saltamos al editor
   */
  goToCreate(): void {
    this.isLoading.set(true);

    this.diagramService.CREATE().subscribe({
      next: (newDiagram) => {
        this.isLoading.set(false);
        this.router.navigate(['/diagram/editor', newDiagram.id]);
      },
      error: (err) => {
        console.error('Error al crear:', err);
        this.isLoading.set(false);
      },
    });
  }

  /**
   * AL EDITAR:
   * Simplemente navegamos al editor con el ID existente
   */
  goToEdit(diagram: DiagramSummaryResponse): void {
    this.router.navigate(['/diagram/editor', diagram.id]);
  }

  handleDelete(diagram: DiagramSummaryResponse): void {
    this.selectedDiagram.set(diagram);
    this.isDeleteModalOpen.set(true);
  }

  confirmDelete(): void {
    const diag = this.selectedDiagram();
    if (!diag) return;

    this.isLoading.set(true);
    this.diagramService.TOGGLE_ACTIVE(diag.id).subscribe({
      next: () => {
        this.diagramas.update((list) =>
          list.map((d) => (d.id === diag.id ? { ...d, isActive: !d.isActive } : d)),
        );
        this.isLoading.set(false);
        this.isDeleteModalOpen.set(false);
      },
      error: () => this.isLoading.set(false),
    });
  }
}
