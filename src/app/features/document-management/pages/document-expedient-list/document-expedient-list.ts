import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { finalize } from 'rxjs';

import { DocumentManagementExpedientSummaryResponse } from '../../interfaces/document-expedient.model';
import { DocumentExpedientService } from '../../services/document-expedient.service';

@Component({
  selector: 'app-document-expedient-list',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './document-expedient-list.html',
  styleUrl: './document-expedient-list.css',
})
export class DocumentExpedientList implements OnInit {
  private readonly documentExpedientService = inject(DocumentExpedientService);

  private readonly dateFormatter = new Intl.DateTimeFormat('es-BO', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });

  public expedients = signal<DocumentManagementExpedientSummaryResponse[]>([]);
  public isLoading = signal(false);
  public errorMessage = signal<string | null>(null);
  public filterText = signal('');

  public filteredExpedients = computed(() => {
    const term = this.normalize(this.filterText());

    return this.orderedExpedients().filter((expedient) => {
      if (!term) {
        return true;
      }

      const searchable = [
        expedient.processCode,
        expedient.clientName || 'Cliente no asociado',
        expedient.clientEmail,
        expedient.diagramName,
        this.formatStatus(expedient.processStatus),
        expedient.processStatus,
      ]
        .filter(Boolean)
        .join(' ');

      return this.normalize(searchable).includes(term);
    });
  });

  public totalReadableRequirements = computed(() =>
    this.filteredExpedients().reduce(
      (total, expedient) => total + expedient.readableRequirementsCount,
      0,
    ),
  );

  public totalUploadedDocuments = computed(() =>
    this.filteredExpedients().reduce(
      (total, expedient) => total + expedient.uploadedDocumentsCount,
      0,
    ),
  );

  public totalPendingDocuments = computed(() =>
    this.filteredExpedients().reduce(
      (total, expedient) => total + expedient.pendingDocumentsCount,
      0,
    ),
  );

  ngOnInit(): void {
    this.loadExpedients();
  }

  loadExpedients(): void {
    this.isLoading.set(true);
    this.errorMessage.set(null);

    this.documentExpedientService
      .getExpedients()
      .pipe(finalize(() => this.isLoading.set(false)))
      .subscribe({
        next: (expedients) => this.expedients.set(expedients),
        error: (error) => {
          console.error('[DOCUMENT-MANAGEMENT][LOAD_EXPEDIENTS_ERROR]', error);
          this.errorMessage.set('No se pudieron cargar los expedientes documentales.');
        },
      });
  }

  setFilter(value: string): void {
    this.filterText.set(value);
  }

  clearFilter(): void {
    this.filterText.set('');
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
      default:
        return 'bg-slate-100 text-slate-700';
    }
  }

  getClientName(expedient: DocumentManagementExpedientSummaryResponse): string {
    return expedient.clientName?.trim() || 'Cliente no asociado';
  }

  getProgressLabel(expedient: DocumentManagementExpedientSummaryResponse): string {
    return `${expedient.uploadedDocumentsCount}/${expedient.readableRequirementsCount}`;
  }

  getProgressPercent(expedient: DocumentManagementExpedientSummaryResponse): number {
    if (expedient.readableRequirementsCount <= 0) {
      return 0;
    }

    return Math.round(
      (expedient.uploadedDocumentsCount / expedient.readableRequirementsCount) * 100,
    );
  }

  private orderedExpedients(): DocumentManagementExpedientSummaryResponse[] {
    return [...this.expedients()].sort((a, b) => {
      const statusWeight = this.statusSortWeight(a.processStatus) - this.statusSortWeight(b.processStatus);

      if (statusWeight !== 0) {
        return statusWeight;
      }

      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });
  }

  private statusSortWeight(status?: string | null): number {
    return status === 'RUNNING' ? 0 : 1;
  }

  private normalize(value: string): string {
    return value
      .toLocaleLowerCase('es-BO')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim();
  }
}
