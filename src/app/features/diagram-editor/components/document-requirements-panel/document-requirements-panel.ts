import { DepartmentResponse } from '#/app/features/config-org/interfaces/departamentos.model';
import { CommonModule } from '@angular/common';
import { Component, Input, OnChanges, SimpleChanges, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  ALLOWED_DOCUMENT_FILE_TYPES,
  AllowedDocumentFileType,
  DocumentRequirement,
  DocumentRequirementRequest,
} from '../../interfaces/document-requirement.models';
import { DocumentRequirementsService } from '../../services/document-requirements.service';

@Component({
  selector: 'app-document-requirements-panel',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './document-requirements-panel.html',
  styleUrl: './document-requirements-panel.css',
})
export class DocumentRequirementsPanelComponent implements OnChanges {
  @Input() diagramId = '';
  @Input() nodeId = '';
  @Input() departments: DepartmentResponse[] = [];
  @Input() disabled = false;

  private readonly service = inject(DocumentRequirementsService);

  public readonly fileTypeOptions = ALLOWED_DOCUMENT_FILE_TYPES;

  public requirements = signal<DocumentRequirement[]>([]);
  public isLoading = signal(false);
  public isSaving = signal(false);
  public errorMessage = signal<string | null>(null);
  public successMessage = signal<string | null>(null);
  public isFormOpen = signal(false);
  public editingRequirement = signal<DocumentRequirement | null>(null);

  public draftName = signal('');
  public draftDescription = signal('');
  public draftRequired = signal(true);
  public draftAllowedFileTypes = signal<AllowedDocumentFileType[]>(['pdf']);
  public draftMaxFileSizeMb = signal(10);
  public draftReadDepartmentIds = signal<string[]>([]);
  public draftUploadDepartmentIds = signal<string[]>([]);
  public draftEditDepartmentIds = signal<string[]>([]);

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['diagramId'] || changes['nodeId']) {
      this.resetForm();
      this.loadRequirements();
    }
  }

  loadRequirements(): void {
    if (!this.diagramId || !this.nodeId) {
      this.requirements.set([]);
      return;
    }

    this.isLoading.set(true);
    this.errorMessage.set(null);

    this.service.LIST_BY_NODE(this.diagramId, this.nodeId).subscribe({
      next: (requirements) => {
        this.requirements.set(requirements);
        this.isLoading.set(false);
      },
      error: (error) => {
        console.error('[DOCUMENT_REQUIREMENTS][LIST_ERROR]', error);
        this.errorMessage.set(this.resolveErrorMessage(error, 'No se pudieron cargar los requisitos.'));
        this.requirements.set([]);
        this.isLoading.set(false);
      },
    });
  }

  requirementCountLabel(): string {
    const count = this.requirements().length;
    if (count === 1) return '1 requisito';
    return `${count} requisitos`;
  }

  startCreate(): void {
    if (this.disabled) return;
    this.resetForm();
    this.isFormOpen.set(true);
  }

  startEdit(requirement: DocumentRequirement): void {
    if (this.disabled) return;

    this.editingRequirement.set(requirement);
    this.draftName.set(requirement.name);
    this.draftDescription.set(requirement.description ?? '');
    this.draftRequired.set(requirement.required);
    this.draftAllowedFileTypes.set([...(requirement.allowedFileTypes ?? [])]);
    this.draftMaxFileSizeMb.set(Number(requirement.maxFileSizeMb ?? 10));
    this.draftReadDepartmentIds.set([...(requirement.readDepartmentIds ?? [])]);
    this.draftUploadDepartmentIds.set([...(requirement.uploadDepartmentIds ?? [])]);
    this.draftEditDepartmentIds.set([...(requirement.editDepartmentIds ?? [])]);
    this.errorMessage.set(null);
    this.successMessage.set(null);
    this.isFormOpen.set(true);
  }

  cancelForm(): void {
    this.resetForm();
  }

  saveRequirement(): void {
    if (this.disabled || this.isSaving()) return;

    const validationError = this.validateDraft();
    if (validationError) {
      this.errorMessage.set(validationError);
      return;
    }

    const payload = this.buildRequest();
    const editing = this.editingRequirement();
    const request$ = editing
      ? this.service.UPDATE(editing.id, payload)
      : this.service.CREATE(this.diagramId, this.nodeId, payload);

    this.isSaving.set(true);
    this.errorMessage.set(null);
    this.successMessage.set(null);

    request$.subscribe({
      next: () => {
        this.isSaving.set(false);
        this.successMessage.set(editing ? 'Requisito actualizado.' : 'Requisito creado.');
        this.resetForm();
        this.loadRequirements();
      },
      error: (error) => {
        console.error('[DOCUMENT_REQUIREMENTS][SAVE_ERROR]', error);
        this.errorMessage.set(this.resolveErrorMessage(error, 'No se pudo guardar el requisito.'));
        this.isSaving.set(false);
      },
    });
  }

  deactivateRequirement(requirement: DocumentRequirement): void {
    if (this.disabled || this.isSaving()) return;

    const confirmed = window.confirm(`Desactivar el requisito "${requirement.name}"?`);
    if (!confirmed) return;

    this.isSaving.set(true);
    this.errorMessage.set(null);
    this.successMessage.set(null);

    this.service.DELETE(requirement.id).subscribe({
      next: () => {
        this.isSaving.set(false);
        this.successMessage.set('Requisito desactivado.');
        this.loadRequirements();
      },
      error: (error) => {
        console.error('[DOCUMENT_REQUIREMENTS][DELETE_ERROR]', error);
        this.errorMessage.set(this.resolveErrorMessage(error, 'No se pudo desactivar el requisito.'));
        this.isSaving.set(false);
      },
    });
  }

  toggleFileType(fileType: AllowedDocumentFileType): void {
    this.toggleValue(this.draftAllowedFileTypes, fileType);
  }

  isFileTypeSelected(fileType: AllowedDocumentFileType): boolean {
    return this.draftAllowedFileTypes().includes(fileType);
  }

  toggleDepartment(
    field: 'readDepartmentIds' | 'uploadDepartmentIds' | 'editDepartmentIds',
    departmentId: string,
  ): void {
    if (field === 'readDepartmentIds') {
      this.toggleValue(this.draftReadDepartmentIds, departmentId);
      return;
    }

    if (field === 'uploadDepartmentIds') {
      this.toggleValue(this.draftUploadDepartmentIds, departmentId);
      return;
    }

    this.toggleValue(this.draftEditDepartmentIds, departmentId);
  }

  isDepartmentSelected(
    field: 'readDepartmentIds' | 'uploadDepartmentIds' | 'editDepartmentIds',
    departmentId: string,
  ): boolean {
    if (field === 'readDepartmentIds') {
      return this.draftReadDepartmentIds().includes(departmentId);
    }

    if (field === 'uploadDepartmentIds') {
      return this.draftUploadDepartmentIds().includes(departmentId);
    }

    return this.draftEditDepartmentIds().includes(departmentId);
  }

  formatFileTypes(types: AllowedDocumentFileType[] | null | undefined): string {
    return (types ?? []).join(', ').toUpperCase();
  }

  formatDepartmentList(departmentIds: string[] | null | undefined): string {
    const ids = departmentIds ?? [];
    if (ids.length === 0) return 'Sin departamentos';

    return ids.map((id) => this.getDepartmentName(id)).join(', ');
  }

  getDepartmentName(departmentId: string): string {
    return this.departments.find((department) => department.id === departmentId)?.name ?? departmentId;
  }

  private resetForm(): void {
    this.editingRequirement.set(null);
    this.isFormOpen.set(false);
    this.draftName.set('');
    this.draftDescription.set('');
    this.draftRequired.set(true);
    this.draftAllowedFileTypes.set(['pdf']);
    this.draftMaxFileSizeMb.set(10);
    this.draftReadDepartmentIds.set([]);
    this.draftUploadDepartmentIds.set([]);
    this.draftEditDepartmentIds.set([]);
    this.errorMessage.set(null);
  }

  private validateDraft(): string | null {
    if (!this.draftName().trim()) {
      return 'El nombre del requisito es obligatorio.';
    }

    if (this.draftAllowedFileTypes().length === 0) {
      return 'Selecciona al menos un tipo permitido.';
    }

    const maxFileSizeMb = Number(this.draftMaxFileSizeMb());
    if (!Number.isFinite(maxFileSizeMb) || maxFileSizeMb < 1 || maxFileSizeMb > 25) {
      return 'El tamano maximo debe estar entre 1 y 25 MB.';
    }

    const hasAnyDepartment =
      this.draftReadDepartmentIds().length > 0 ||
      this.draftUploadDepartmentIds().length > 0 ||
      this.draftEditDepartmentIds().length > 0;

    if (!hasAnyDepartment) {
      return 'Selecciona al menos un departamento en lectura, carga o edicion.';
    }

    return null;
  }

  private buildRequest(): DocumentRequirementRequest {
    return {
      name: this.draftName().trim(),
      description: this.draftDescription().trim() || null,
      required: this.draftRequired(),
      allowedFileTypes: [...this.draftAllowedFileTypes()],
      maxFileSizeMb: Number(this.draftMaxFileSizeMb()),
      readDepartmentIds: [...this.draftReadDepartmentIds()],
      uploadDepartmentIds: [...this.draftUploadDepartmentIds()],
      editDepartmentIds: [...this.draftEditDepartmentIds()],
    };
  }

  private toggleValue<T>(target: { (): T[]; set(value: T[]): void }, value: T): void {
    const current = target();
    const next = current.includes(value)
      ? current.filter((item) => item !== value)
      : [...current, value];

    target.set(next);
  }

  private resolveErrorMessage(error: unknown, fallback: string): string {
    if (error && typeof error === 'object' && 'error' in error) {
      const httpError = error as { error?: { message?: unknown; detail?: unknown } };
      const message = httpError.error?.message ?? httpError.error?.detail;
      if (message) return String(message);
    }

    return fallback;
  }
}
