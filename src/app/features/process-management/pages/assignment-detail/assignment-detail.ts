import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';

import {
  FieldDefinition,
  FieldType,
  TemplateResponse,
} from '#/app/features/config-org/interfaces/plantillas.models';
import { TemplateService } from '#/app/features/config-org/services/plantillas.service';

import {
  AssignmentResponse,
  CompleteAssignmentRequest,
} from '../../interfaces/process-assignment.model';
import {
  HistoryFieldResponse,
  HistoryResponse,
  ProcessInstanceDetailResponse,
} from '../../interfaces/process-instance.model';
import { ProcessAssignmentService } from '../../services/process-assignment.service';
import { ProcessInstanceService } from '../../services/process-instance.service';

@Component({
  selector: 'app-assignment-detail',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './assignment-detail.html',
})
export class AssignmentDetail implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly processAssignmentService = inject(ProcessAssignmentService);
  private readonly processInstanceService = inject(ProcessInstanceService);
  private readonly templateService = inject(TemplateService);
  private readonly dateFormatter = new Intl.DateTimeFormat('es-BO', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });

  public readonly FieldType = FieldType;

  public assignment = signal<AssignmentResponse | null>(null);
  public processDetail = signal<ProcessInstanceDetailResponse | null>(null);
  public template = signal<TemplateResponse | null>(null);

  public templateResponseData = signal<Record<string, unknown>>({});

  public isLoading = signal(false);
  public isLoadingTemplate = signal(false);
  public isSubmitting = signal(false);

  public errorMessage = signal<string | null>(null);
  public successMessage = signal<string | null>(null);

  public comment = signal('');

  public sortedTemplateFields = computed(() => {
    const fields = this.template()?.fields ?? [];

    return [...fields]
      .filter((field) => !field.isInternalOnly)
      .sort((a, b) => (a.uiProps?.order ?? 0) - (b.uiProps?.order ?? 0));
  });

  public previousHistory = computed(() => {
    const currentAssignment = this.assignment();
    const history = this.processDetail()?.history ?? [];

    return history
      .filter((item) => item.assignmentId !== currentAssignment?.id)
      .sort((a, b) => new Date(b.performedAt).getTime() - new Date(a.performedAt).getTime());
  });

  ngOnInit(): void {
    const assignmentId = this.route.snapshot.paramMap.get('assignmentId');

    if (!assignmentId) {
      this.errorMessage.set('No se encontró el identificador de la asignación.');
      return;
    }

    this.loadAssignment(assignmentId);
  }

  loadAssignment(assignmentId: string): void {
    this.isLoading.set(true);
    this.errorMessage.set(null);

    this.processAssignmentService.GET_BY_ID(assignmentId).subscribe({
      next: (assignment) => {
        this.assignment.set(assignment);
        this.loadProcessDetail(assignment.processInstanceId);

        if (assignment.templateDocumentId) {
          this.loadTemplate(assignment.templateDocumentId);
        } else {
          this.isLoading.set(false);
        }
      },
      error: (error) => {
        console.error('[ASSIGNMENT-DETAIL][LOAD_ASSIGNMENT_ERROR]', error);
        this.errorMessage.set('No se pudo cargar la asignación.');
        this.isLoading.set(false);
      },
    });
  }

  loadProcessDetail(processInstanceId: string): void {
    this.processInstanceService.GET_BY_ID(processInstanceId, false).subscribe({
      next: (detail) => {
        this.processDetail.set(detail);
        this.isLoading.set(false);
      },
      error: (error) => {
        console.error('[ASSIGNMENT-DETAIL][LOAD_PROCESS_ERROR]', error);
        this.errorMessage.set('No se pudo cargar el detalle del proceso.');
        this.isLoading.set(false);
      },
    });
  }

  loadTemplate(templateId: string): void {
    this.isLoadingTemplate.set(true);

    this.templateService.GET_BY_ID(templateId).subscribe({
      next: (template) => {
        this.template.set(template);
        this.initializeTemplateResponse(template.fields);
        this.isLoadingTemplate.set(false);
      },
      error: (error) => {
        console.error('[ASSIGNMENT-DETAIL][LOAD_TEMPLATE_ERROR]', error);
        this.errorMessage.set('No se pudo cargar la plantilla asociada.');
        this.isLoadingTemplate.set(false);
      },
    });
  }

  initializeTemplateResponse(fields: FieldDefinition[]): void {
    const initialData: Record<string, unknown> = {};

    for (const field of fields) {
      if (field.isInternalOnly) {
        continue;
      }

      if (field.type === FieldType.MULTIPLE_CHOICE) {
        initialData[field.fieldId] = [];
      } else {
        initialData[field.fieldId] = '';
      }
    }

    this.templateResponseData.set(initialData);
  }

  getFieldValue(fieldId: string): unknown {
    return this.templateResponseData()[fieldId] ?? '';
  }

  getStringFieldValue(fieldId: string): string {
    const value = this.getFieldValue(fieldId);
    return value === null || value === undefined ? '' : String(value);
  }

  updateFieldValue(field: FieldDefinition, value: unknown): void {
    this.templateResponseData.update((current) => {
      const next = { ...current };

      if (field.type === FieldType.NUMBER) {
        next[field.fieldId] = value === '' || value === null ? null : Number(value);
      } else {
        next[field.fieldId] = value;
      }

      return next;
    });
  }

  isOptionSelected(field: FieldDefinition, optionValue: string): boolean {
    const value = this.templateResponseData()[field.fieldId];

    if (!Array.isArray(value)) {
      return false;
    }

    return value.includes(optionValue);
  }

  toggleMultipleChoice(field: FieldDefinition, optionValue: string): void {
    this.templateResponseData.update((current) => {
      const currentValue = current[field.fieldId];
      const selectedValues = Array.isArray(currentValue) ? [...currentValue] : [];

      const exists = selectedValues.includes(optionValue);

      const nextValues = exists
        ? selectedValues.filter((value) => value !== optionValue)
        : [...selectedValues, optionValue];

      return {
        ...current,
        [field.fieldId]: nextValues,
      };
    });
  }

  completeAssignment(): void {
    const assignment = this.assignment();

    if (!assignment) {
      this.errorMessage.set('No hay una asignación cargada.');
      return;
    }

    if (assignment.status !== 'PENDING') {
      this.errorMessage.set('Esta asignación ya no está pendiente.');
      return;
    }

    const validationError = this.validateTemplateRequiredFields();

    if (validationError) {
      this.errorMessage.set(validationError);
      return;
    }

    const request: CompleteAssignmentRequest = {
      transitionLabel: null,
      targetNodeId: null,
      templateResponseData: this.templateResponseData(),
      attachments: [],
      comment: this.comment().trim() || null,
    };

    this.isSubmitting.set(true);
    this.errorMessage.set(null);
    this.successMessage.set(null);

    this.processInstanceService
      .COMPLETE_ASSIGNMENT(assignment.processInstanceId, assignment.id, request)
      .subscribe({
        next: () => {
          this.successMessage.set('La tarea fue completada correctamente.');
          this.isSubmitting.set(false);

          setTimeout(() => {
            this.router.navigate(['/process']);
          }, 700);
        },
        error: (error) => {
          console.error('[ASSIGNMENT-DETAIL][COMPLETE_ERROR]', error);
          this.errorMessage.set(
            error?.error?.message || error?.error?.detail || 'No se pudo completar la tarea.',
          );
          this.isSubmitting.set(false);
        },
      });
  }

  validateTemplateRequiredFields(): string | null {
    const fields = this.sortedTemplateFields();
    const response = this.templateResponseData();

    for (const field of fields) {
      if (!field.required) {
        continue;
      }

      const value = response[field.fieldId];

      if (Array.isArray(value) && value.length === 0) {
        return `El campo "${field.label}" es obligatorio.`;
      }

      if (value === null || value === undefined || String(value).trim() === '') {
        return `El campo "${field.label}" es obligatorio.`;
      }
    }

    return null;
  }

  getGridClass(field: FieldDefinition): string {
    return field.uiProps?.gridCols === 2 ? 'md:col-span-2' : '';
  }

  getHistoryFields(history: HistoryResponse): HistoryFieldResponse[] {
    if (history.templateResponseFields && history.templateResponseFields.length > 0) {
      return history.templateResponseFields;
    }

    return Object.entries(history.templateResponseData ?? {}).map(([key, value]) => ({
      fieldId: key,
      label: key,
      value,
    }));
  }

  formatHistoryValue(value: unknown): string {
    if (value === null || value === undefined) {
      return 'Sin valor';
    }

    if (Array.isArray(value)) {
      return value.length > 0 ? value.join(', ') : 'Sin valor';
    }

    if (typeof value === 'object') {
      return JSON.stringify(value);
    }

    return String(value);
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
    if (!status) {
      return 'Sin estado';
    }

    switch (status) {
      case 'PENDING':
        return 'Pendiente';
      case 'COMPLETED':
        return 'Completada';
      case 'CANCELLED':
        return 'Cancelada';
      case 'RUNNING':
        return 'En ejecución';
      case 'PENDING_ASSIGNMENT':
        return 'Pendiente de asignación';
      default:
        return status;
    }
  }

  goBack(): void {
    this.router.navigate(['/process']);
  }
}
