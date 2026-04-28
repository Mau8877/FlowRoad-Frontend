import { CommonModule } from '@angular/common';
import { Component, NgZone, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Bot, LucideAngularModule, Mic, MicOff, Sparkles, Wand2 } from 'lucide-angular';
import { finalize } from 'rxjs';

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
import { WorkerAiRequest, WorkerFieldSuggestion } from '../../interfaces/worker-ai.model';
import { ProcessAssignmentService } from '../../services/process-assignment.service';
import { ProcessInstanceService } from '../../services/process-instance.service';
import { WorkerAiService } from '../../services/worker-ai.service';

interface BrowserSpeechRecognitionAlternative {
  transcript: string;
  confidence?: number;
}

interface BrowserSpeechRecognitionResult {
  isFinal: boolean;
  length: number;
  [index: number]: BrowserSpeechRecognitionAlternative;
}

interface BrowserSpeechRecognitionResultList {
  length: number;
  [index: number]: BrowserSpeechRecognitionResult;
}

interface BrowserSpeechRecognitionEvent {
  resultIndex: number;
  results: BrowserSpeechRecognitionResultList;
}

interface BrowserSpeechRecognitionErrorEvent {
  error?: string;
  message?: string;
}

interface BrowserSpeechRecognition {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onstart: (() => void) | null;
  onend: (() => void) | null;
  onerror: ((event: BrowserSpeechRecognitionErrorEvent) => void) | null;
  onresult: ((event: BrowserSpeechRecognitionEvent) => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}

type BrowserSpeechRecognitionConstructor = new () => BrowserSpeechRecognition;

@Component({
  selector: 'app-assignment-detail',
  standalone: true,
  imports: [CommonModule, FormsModule, LucideAngularModule],
  templateUrl: './assignment-detail.html',
})
export class AssignmentDetail implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly ngZone = inject(NgZone);
  private readonly processAssignmentService = inject(ProcessAssignmentService);
  private readonly processInstanceService = inject(ProcessInstanceService);
  private readonly templateService = inject(TemplateService);
  private readonly workerAiService = inject(WorkerAiService);

  private readonly dateFormatter = new Intl.DateTimeFormat('es-BO', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });

  private speechRecognition: BrowserSpeechRecognition | null = null;
  private activeSpeechField: FieldDefinition | null = null;
  private baseFieldTextBeforeRecording = '';

  public readonly FieldType = FieldType;

  public readonly icons = {
    Bot,
    Mic,
    MicOff,
    Sparkles,
    Wand2,
  };

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

  public aiLoadingFieldId = signal<string | null>(null);
  public isAiCompletingAll = signal(false);
  public aiSuggestionByFieldId = signal<Record<string, WorkerFieldSuggestion>>({});
  public aiErrorByFieldId = signal<Record<string, string>>({});

  public recordingFieldId = signal<string | null>(null);
  public speechErrorByFieldId = signal<Record<string, string>>({});

  public isSpeechSupported = computed(() => {
    return Boolean(this.getSpeechRecognitionConstructor());
  });

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

  ngOnDestroy(): void {
    this.abortDictation();
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
    this.clearFieldFeedback(field.fieldId);

    this.templateResponseData.update((current) => {
      const next = { ...current };

      if (field.type === FieldType.NUMBER) {
        if (value === '' || value === null || value === undefined) {
          next[field.fieldId] = null;
        } else {
          const numericValue = Number(value);
          next[field.fieldId] = Number.isNaN(numericValue) ? null : numericValue;
        }
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
    this.clearFieldFeedback(field.fieldId);

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

  generateAiSuggestionForField(field: FieldDefinition): void {
    const template = this.template();
    const assignment = this.assignment();

    if (!template || !assignment || this.aiLoadingFieldId() || this.isAiCompletingAll()) {
      return;
    }

    if (assignment.status !== 'PENDING') {
      this.setAiFieldError(field.fieldId, 'Esta tarea ya no está pendiente.');
      return;
    }

    const payload = this.buildWorkerAiRequest(field, template, assignment);

    this.aiLoadingFieldId.set(field.fieldId);
    this.setAiFieldError(field.fieldId, '');

    this.workerAiService
      .TEMPLATE_ASSIST(payload)
      .pipe(finalize(() => this.aiLoadingFieldId.set(null)))
      .subscribe({
        next: (response) => {
          const suggestion = response.field_suggestions.find(
            (item) => item.field_id === field.fieldId,
          );

          if (!suggestion) {
            this.setAiFieldError(
              field.fieldId,
              'La IA no devolvió una sugerencia para este campo.',
            );
            return;
          }

          this.aiSuggestionByFieldId.update((current) => ({
            ...current,
            [field.fieldId]: suggestion,
          }));

          this.applyAiSuggestion(field, suggestion);
        },
        error: (error) => {
          console.error('[ASSIGNMENT-DETAIL][WORKER_AI_ERROR]', error);

          const message =
            error?.error?.detail?.message ??
            error?.error?.message ??
            'No se pudo generar la sugerencia IA.';

          this.setAiFieldError(field.fieldId, String(message));
        },
      });
  }

  autocompleteAllFieldsWithAi(): void {
    const template = this.template();
    const assignment = this.assignment();

    if (!template || !assignment || this.isAiCompletingAll() || this.aiLoadingFieldId()) {
      return;
    }

    if (assignment.status !== 'PENDING') {
      this.errorMessage.set('Esta tarea ya no está pendiente.');
      return;
    }

    const payload = this.buildWorkerAiRequestForAllFields(template, assignment);

    this.isAiCompletingAll.set(true);
    this.errorMessage.set(null);
    this.successMessage.set(null);

    this.workerAiService
      .TEMPLATE_ASSIST(payload)
      .pipe(finalize(() => this.isAiCompletingAll.set(false)))
      .subscribe({
        next: (response) => {
          if (!response.field_suggestions.length) {
            this.errorMessage.set('La IA no devolvió sugerencias para la plantilla.');
            return;
          }

          const fieldsById = this.sortedTemplateFields().reduce<Record<string, FieldDefinition>>(
            (acc, field) => {
              acc[field.fieldId] = field;
              return acc;
            },
            {},
          );

          const nextSuggestions: Record<string, WorkerFieldSuggestion> = {};

          for (const suggestion of response.field_suggestions) {
            const field = fieldsById[suggestion.field_id];

            if (!field) {
              continue;
            }

            nextSuggestions[field.fieldId] = suggestion;
            this.applyAiSuggestion(field, suggestion);
          }

          this.aiSuggestionByFieldId.update((current) => ({
            ...current,
            ...nextSuggestions,
          }));

          if (response.warnings.length) {
            this.errorMessage.set(response.warnings.join(' | '));
          }

          this.successMessage.set('La IA autocompletó los campos posibles del informe.');
        },
        error: (error) => {
          console.error('[ASSIGNMENT-DETAIL][WORKER_AI_ALL_ERROR]', error);

          const message =
            error?.error?.detail?.message ??
            error?.error?.message ??
            'No se pudo autocompletar el informe con IA.';

          this.errorMessage.set(String(message));
        },
      });
  }

  applyAiSuggestion(field: FieldDefinition, suggestion: WorkerFieldSuggestion): void {
    if (field.type === FieldType.FILE || field.type === FieldType.PHOTO) {
      return;
    }

    if (suggestion.suggested_value === null || suggestion.suggested_value === undefined) {
      return;
    }

    if (field.type === FieldType.MULTIPLE_CHOICE) {
      const values = Array.isArray(suggestion.suggested_value) ? suggestion.suggested_value : [];
      this.updateFieldValue(field, values);
      return;
    }

    this.updateFieldValue(field, suggestion.suggested_value);
  }

  buildWorkerAiRequest(
    field: FieldDefinition,
    template: TemplateResponse,
    assignment: AssignmentResponse,
  ): WorkerAiRequest {
    const currentValue = this.templateResponseData()[field.fieldId];
    const hasCurrentValue = !this.isEmptyValue(currentValue);

    const workerMessage = hasCurrentValue
      ? [
          `Mejora, formaliza y enriquece el valor actual del campo "${field.label}".`,
          'No cambies el sentido original.',
          `Valor actual: ${this.formatUnknownValue(currentValue)}`,
          this.comment().trim() ? `Comentario adicional: ${this.comment().trim()}` : '',
        ]
          .filter(Boolean)
          .join('\n')
      : [
          `Completa el campo vacío "${field.label}" usando el contexto disponible.`,
          this.comment().trim() ? `Comentario adicional: ${this.comment().trim()}` : '',
        ]
          .filter(Boolean)
          .join('\n');

    return {
      worker_message: workerMessage,
      task_name: assignment.nodeName,
      process_name: this.processDetail()?.instance?.diagramName ?? null,
      worker_name: assignment.assignedUserName,
      department_name: assignment.assignedDepartmentName ?? assignment.laneName ?? null,
      target_field_id: field.fieldId,
      template,
      current_values: this.templateResponseData(),
      extra_context: this.buildWorkerExtraContext(),
    };
  }

  buildWorkerAiRequestForAllFields(
    template: TemplateResponse,
    assignment: AssignmentResponse,
  ): WorkerAiRequest {
    const commentValue = this.comment().trim();

    const workerMessage = [
      'Autocompleta todos los campos posibles del informe usando el contexto disponible.',
      'Si un campo ya tiene valor, mejóralo y formalízalo sin cambiar su sentido.',
      'Si un campo está vacío, complétalo con una sugerencia razonable.',
      'No inventes archivos, fotos, URLs ni datos que no estén justificados.',
      commentValue ? `Comentario adicional del trabajador: ${commentValue}` : '',
    ]
      .filter(Boolean)
      .join('\n');

    return {
      worker_message: workerMessage,
      task_name: assignment.nodeName,
      process_name: this.processDetail()?.instance?.diagramName ?? null,
      worker_name: assignment.assignedUserName,
      department_name: assignment.assignedDepartmentName ?? assignment.laneName ?? null,
      target_field_id: null,
      template,
      current_values: this.templateResponseData(),
      extra_context: this.buildWorkerExtraContext(),
    };
  }

  buildWorkerExtraContext(): Record<string, unknown> {
    const processDetail = this.processDetail();
    const assignment = this.assignment();

    return {
      assignment: assignment
        ? {
            id: assignment.id,
            node_id: assignment.nodeId,
            node_name: assignment.nodeName,
            status: assignment.status,
            assigned_department_name:
              assignment.assignedDepartmentName ?? assignment.laneName ?? null,
            assigned_user_name: assignment.assignedUserName,
          }
        : null,
      process: processDetail
        ? {
            id: processDetail.instance.id,
            code: processDetail.instance.code,
            diagram_name: processDetail.instance.diagramName,
            status: processDetail.instance.status,
            request_data: processDetail.requestData,
          }
        : null,
      previous_history: this.previousHistory()
        .slice(0, 5)
        .map((history) => ({
          from_node_name: history.fromNodeName,
          template_name: history.templateName,
          performed_by_user_name: history.performedByUserName,
          performed_at: history.performedAt,
          fields: this.getHistoryFields(history),
          comment: history.comment,
        })),
    };
  }

  canUseVoiceForField(field: FieldDefinition): boolean {
    return field.type === FieldType.TEXT || field.type === FieldType.TEXTAREA;
  }

  toggleFieldDictation(field: FieldDefinition): void {
    if (!this.canUseVoiceForField(field)) {
      this.setSpeechFieldError(field.fieldId, 'El dictado solo está habilitado para texto.');
      return;
    }

    if (this.recordingFieldId() === field.fieldId) {
      this.stopDictation();
      return;
    }

    this.startFieldDictation(field);
  }

  startFieldDictation(field: FieldDefinition): void {
    this.setSpeechFieldError(field.fieldId, '');

    const SpeechRecognitionConstructor = this.getSpeechRecognitionConstructor();

    if (!SpeechRecognitionConstructor) {
      this.setSpeechFieldError(
        field.fieldId,
        'El navegador no soporta reconocimiento de voz. Para tus pruebas usa Microsoft Edge.',
      );
      return;
    }

    this.abortDictation();

    const recognition = new SpeechRecognitionConstructor();

    this.speechRecognition = recognition;
    this.activeSpeechField = field;
    this.baseFieldTextBeforeRecording = this.getStringFieldValue(field.fieldId).trim();

    recognition.lang = 'es-ES';
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      this.ngZone.run(() => {
        this.recordingFieldId.set(field.fieldId);
        this.setSpeechFieldError(field.fieldId, '');
      });
    };

    recognition.onresult = (event: BrowserSpeechRecognitionEvent) => {
      const transcript = this.extractTranscript(event);

      this.ngZone.run(() => {
        if (!transcript || !this.activeSpeechField) {
          return;
        }

        const merged = `${this.baseFieldTextBeforeRecording} ${transcript}`
          .replace(/\s+/g, ' ')
          .trim();

        this.updateFieldValue(this.activeSpeechField, merged);
      });
    };

    recognition.onerror = (event: BrowserSpeechRecognitionErrorEvent) => {
      this.ngZone.run(() => {
        const error = event.error ?? event.message ?? 'desconocido';
        const activeFieldId = this.activeSpeechField?.fieldId ?? field.fieldId;

        this.recordingFieldId.set(null);

        if (error === 'aborted') {
          return;
        }

        if (error === 'no-speech') {
          this.setSpeechFieldError(
            activeFieldId,
            'No se detectó voz. Intenta hablar más cerca del micrófono.',
          );
          return;
        }

        if (error === 'not-allowed') {
          this.setSpeechFieldError(
            activeFieldId,
            'El navegador bloqueó el micrófono. Revisa los permisos del sitio.',
          );
          return;
        }

        if (error === 'audio-capture') {
          this.setSpeechFieldError(
            activeFieldId,
            'No se pudo capturar audio. Revisa que el micrófono esté disponible.',
          );
          return;
        }

        if (error === 'network') {
          this.setSpeechFieldError(
            activeFieldId,
            'No se pudo conectar con el reconocimiento de voz. Prueba nuevamente en Edge.',
          );
          return;
        }

        this.setSpeechFieldError(
          activeFieldId,
          `No se pudo completar el dictado. Error: ${error}.`,
        );
      });
    };

    recognition.onend = () => {
      this.ngZone.run(() => {
        this.recordingFieldId.set(null);
        this.speechRecognition = null;
        this.activeSpeechField = null;
      });
    };

    try {
      recognition.start();
    } catch {
      this.recordingFieldId.set(null);
      this.speechRecognition = null;
      this.activeSpeechField = null;
      this.setSpeechFieldError(
        field.fieldId,
        'No se pudo iniciar el dictado. Recarga la página e intenta nuevamente.',
      );
    }
  }

  stopDictation(): void {
    if (!this.speechRecognition) {
      this.recordingFieldId.set(null);
      return;
    }

    try {
      this.speechRecognition.stop();
    } catch {
      this.abortDictation();
    }
  }

  abortDictation(): void {
    if (!this.speechRecognition) {
      this.recordingFieldId.set(null);
      return;
    }

    try {
      this.speechRecognition.abort();
    } catch {
      // Solo limpiamos estado local.
    }

    this.speechRecognition = null;
    this.activeSpeechField = null;
    this.recordingFieldId.set(null);
  }

  getFieldFeedback(fieldId: string): string | null {
    const aiError = this.aiErrorByFieldId()[fieldId];

    if (aiError) {
      return aiError;
    }

    const speechError = this.speechErrorByFieldId()[fieldId];

    if (speechError) {
      return speechError;
    }

    const suggestionWarning = this.aiSuggestionByFieldId()[fieldId]?.warning;

    return suggestionWarning || null;
  }

  getFieldAiSuggestion(fieldId: string): WorkerFieldSuggestion | null {
    return this.aiSuggestionByFieldId()[fieldId] ?? null;
  }

  isAiGeneratingField(fieldId: string): boolean {
    return this.aiLoadingFieldId() === fieldId;
  }

  isRecordingField(fieldId: string): boolean {
    return this.recordingFieldId() === fieldId;
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

  private setAiFieldError(fieldId: string, message: string): void {
    this.aiErrorByFieldId.update((current) => {
      const next = { ...current };

      if (message) {
        next[fieldId] = message;
      } else {
        delete next[fieldId];
      }

      return next;
    });
  }

  private setSpeechFieldError(fieldId: string, message: string): void {
    this.speechErrorByFieldId.update((current) => {
      const next = { ...current };

      if (message) {
        next[fieldId] = message;
      } else {
        delete next[fieldId];
      }

      return next;
    });
  }

  private clearFieldFeedback(fieldId: string): void {
    this.setAiFieldError(fieldId, '');
    this.setSpeechFieldError(fieldId, '');
  }

  private isEmptyValue(value: unknown): boolean {
    if (value === null || value === undefined) {
      return true;
    }

    if (Array.isArray(value)) {
      return value.length === 0;
    }

    return String(value).trim() === '';
  }

  private formatUnknownValue(value: unknown): string {
    if (value === null || value === undefined) {
      return '';
    }

    if (Array.isArray(value)) {
      return value.join(', ');
    }

    if (typeof value === 'object') {
      return JSON.stringify(value);
    }

    return String(value);
  }

  private extractTranscript(event: BrowserSpeechRecognitionEvent): string {
    const results = Array.from(
      { length: event.results.length },
      (_, index) => event.results[index],
    );

    return results
      .map((result) => result[0]?.transcript ?? '')
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private getSpeechRecognitionConstructor(): BrowserSpeechRecognitionConstructor | null {
    if (typeof window === 'undefined') {
      return null;
    }

    const speechWindow = window as Window & {
      SpeechRecognition?: BrowserSpeechRecognitionConstructor;
      webkitSpeechRecognition?: BrowserSpeechRecognitionConstructor;
    };

    return speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition ?? null;
  }
}
