import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { finalize } from 'rxjs';

import {
  DocumentExpedientItemResponse,
  DocumentManagementExpedientDetailResponse,
} from '../../interfaces/document-expedient.model';
import { DocumentExpedientService } from '../../services/document-expedient.service';

type DocumentAction = 'upload' | 'replace' | 'download';

@Component({
  selector: 'app-document-expedient-detail',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './document-expedient-detail.html',
  styleUrl: './document-expedient-detail.css',
})
export class DocumentExpedientDetail implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly documentExpedientService = inject(DocumentExpedientService);

  private readonly dateFormatter = new Intl.DateTimeFormat('es-BO', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });

  public expedient = signal<DocumentManagementExpedientDetailResponse | null>(null);
  public isLoading = signal(false);
  public errorMessage = signal<string | null>(null);
  public successMessage = signal<string | null>(null);
  public itemActionLoading = signal<Record<string, DocumentAction>>({});
  public itemErrors = signal<Record<string, string>>({});

  public totalRequirements = computed(() => this.expedient()?.items.length ?? 0);
  public uploadedDocuments = computed(
    () => this.expedient()?.items.filter((item) => Boolean(item.currentFile)).length ?? 0,
  );
  public pendingDocuments = computed(() => this.totalRequirements() - this.uploadedDocuments());
  public requiredPendingDocuments = computed(
    () =>
      this.expedient()?.items.filter((item) => item.requirement.required && !item.currentFile)
        .length ?? 0,
  );

  ngOnInit(): void {
    const processInstanceId = this.route.snapshot.paramMap.get('processInstanceId');

    if (!processInstanceId) {
      this.errorMessage.set('No se encontró el identificador del expediente.');
      return;
    }

    this.loadExpedient(processInstanceId);
  }

  loadExpedient(processInstanceId: string, keepSuccessMessage = false): void {
    this.isLoading.set(true);
    this.errorMessage.set(null);

    if (!keepSuccessMessage) {
      this.successMessage.set(null);
    }

    this.documentExpedientService
      .getExpedient(processInstanceId)
      .pipe(finalize(() => this.isLoading.set(false)))
      .subscribe({
        next: (expedient) => this.expedient.set(expedient),
        error: (error) => {
          console.error('[DOCUMENT-MANAGEMENT][LOAD_EXPEDIENT_ERROR]', error);
          this.errorMessage.set('No se pudo cargar el expediente documental.');
        },
      });
  }

  handleUpload(item: DocumentExpedientItemResponse, event: Event): void {
    const file = this.getSelectedFile(event);
    this.resetFileInput(event);

    if (!file || !this.expedient()) {
      return;
    }

    if (!this.validateFile(item, file)) {
      return;
    }

    this.setItemLoading(item.requirement.id, 'upload');
    this.clearItemError(item.requirement.id);
    this.successMessage.set(null);

    this.documentExpedientService
      .uploadDocument(this.expedient()!.processInstanceId, item.requirement.id, file)
      .pipe(finalize(() => this.clearItemLoading(item.requirement.id)))
      .subscribe({
        next: () => {
          this.successMessage.set('Documento subido correctamente.');
          this.loadExpedient(this.expedient()!.processInstanceId, true);
        },
        error: (error) => {
          console.error('[DOCUMENT-MANAGEMENT][UPLOAD_ERROR]', error);
          this.setItemError(item.requirement.id, 'No se pudo subir el documento.');
        },
      });
  }

  handleReplace(item: DocumentExpedientItemResponse, event: Event): void {
    const file = this.getSelectedFile(event);
    this.resetFileInput(event);

    if (!file || !this.expedient() || !item.currentFile) {
      return;
    }

    if (!this.validateFile(item, file)) {
      return;
    }

    const confirmed = window.confirm(
      `¿Deseas reemplazar "${item.currentFile.originalFileName}" por "${file.name}"?`,
    );

    if (!confirmed) {
      return;
    }

    this.setItemLoading(item.requirement.id, 'replace');
    this.clearItemError(item.requirement.id);
    this.successMessage.set(null);

    this.documentExpedientService
      .replaceDocument(this.expedient()!.processInstanceId, item.currentFile.id, file)
      .pipe(finalize(() => this.clearItemLoading(item.requirement.id)))
      .subscribe({
        next: () => {
          this.successMessage.set('Documento reemplazado correctamente.');
          this.loadExpedient(this.expedient()!.processInstanceId, true);
        },
        error: (error) => {
          console.error('[DOCUMENT-MANAGEMENT][REPLACE_ERROR]', error);
          this.setItemError(item.requirement.id, 'No se pudo reemplazar el documento.');
        },
      });
  }

  downloadDocument(item: DocumentExpedientItemResponse): void {
    if (!this.expedient() || !item.currentFile || !item.canRead) {
      return;
    }

    this.setItemLoading(item.requirement.id, 'download');
    this.clearItemError(item.requirement.id);
    this.successMessage.set(null);

    this.documentExpedientService
      .getDownloadUrl(this.expedient()!.processInstanceId, item.currentFile.id)
      .pipe(finalize(() => this.clearItemLoading(item.requirement.id)))
      .subscribe({
        next: (response) => {
          window.open(response.downloadUrl, '_blank');
        },
        error: (error) => {
          console.error('[DOCUMENT-MANAGEMENT][DOWNLOAD_ERROR]', error);
          this.setItemError(item.requirement.id, 'No se pudo preparar la descarga.');
        },
      });
  }

  isItemLoading(item: DocumentExpedientItemResponse, action?: DocumentAction): boolean {
    const currentAction = this.itemActionLoading()[item.requirement.id];

    return action ? currentAction === action : Boolean(currentAction);
  }

  getItemError(item: DocumentExpedientItemResponse): string | null {
    return this.itemErrors()[item.requirement.id] ?? null;
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
      case 'UPLOADED':
        return 'Subido';
      case 'PENDING':
        return 'Pendiente';
      default:
        return status || 'Sin estado';
    }
  }

  getStatusBadgeClass(status?: string | null): string {
    switch (status) {
      case 'RUNNING':
      case 'UPLOADED':
        return 'bg-green-50 text-green-700';
      case 'PENDING_ASSIGNMENT':
      case 'PENDING':
        return 'bg-amber-50 text-amber-700';
      case 'COMPLETED':
        return 'bg-blue-50 text-blue-700';
      case 'CANCELLED':
        return 'bg-red-50 text-red-700';
      default:
        return 'bg-slate-100 text-slate-700';
    }
  }

  formatFileSize(bytes?: number | null): string {
    if (!bytes || bytes <= 0) {
      return '0 B';
    }

    const units = ['B', 'KB', 'MB', 'GB'];
    const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
    const size = bytes / Math.pow(1024, index);

    return `${size.toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
  }

  formatAllowedTypes(item: DocumentExpedientItemResponse): string {
    const allowedTypes = item.requirement.allowedFileTypes ?? [];

    return allowedTypes.length > 0 ? allowedTypes.join(', ') : 'Sin restricción';
  }

  getAcceptAttribute(item: DocumentExpedientItemResponse): string | null {
    const allowedTypes = item.requirement.allowedFileTypes ?? [];

    return allowedTypes.length > 0 ? allowedTypes.join(',') : null;
  }

  goBack(): void {
    this.router.navigate(['/document-management']);
  }

  private validateFile(item: DocumentExpedientItemResponse, file: File): boolean {
    const maxBytes = (item.requirement.maxFileSizeMb ?? 0) * 1024 * 1024;

    if (maxBytes > 0 && file.size > maxBytes) {
      this.setItemError(
        item.requirement.id,
        `El archivo supera el tamaño máximo de ${item.requirement.maxFileSizeMb} MB.`,
      );
      return false;
    }

    const allowedTypes = item.requirement.allowedFileTypes ?? [];

    if (allowedTypes.length > 0 && !this.isAllowedFileType(file, allowedTypes)) {
      this.setItemError(
        item.requirement.id,
        `Tipo no permitido. Usa: ${allowedTypes.join(', ')}.`,
      );
      return false;
    }

    return true;
  }

  private isAllowedFileType(file: File, allowedTypes: string[]): boolean {
    const fileName = file.name.toLowerCase();
    const mimeType = file.type.toLowerCase();

    return allowedTypes.some((allowedType) => {
      const normalizedType = allowedType.toLowerCase().trim();

      if (!normalizedType) {
        return false;
      }

      if (normalizedType.includes('/')) {
        return mimeType === normalizedType;
      }

      const extension = normalizedType.startsWith('.') ? normalizedType : `.${normalizedType}`;

      return fileName.endsWith(extension);
    });
  }

  private getSelectedFile(event: Event): File | null {
    const input = event.target as HTMLInputElement;

    return input.files?.item(0) ?? null;
  }

  private resetFileInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    input.value = '';
  }

  private setItemLoading(itemId: string, action: DocumentAction): void {
    this.itemActionLoading.update((current) => ({ ...current, [itemId]: action }));
  }

  private clearItemLoading(itemId: string): void {
    this.itemActionLoading.update((current) => {
      const next = { ...current };
      delete next[itemId];
      return next;
    });
  }

  private setItemError(itemId: string, message: string): void {
    this.itemErrors.update((current) => ({ ...current, [itemId]: message }));
  }

  private clearItemError(itemId: string): void {
    this.itemErrors.update((current) => {
      const next = { ...current };
      delete next[itemId];
      return next;
    });
  }
}
