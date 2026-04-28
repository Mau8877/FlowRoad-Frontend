import { CommonModule } from '@angular/common';
import {
  AfterViewInit,
  Component,
  ElementRef,
  HostListener,
  OnDestroy,
  OnInit,
  ViewChild,
  inject,
  signal,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import {
  Observable,
  catchError,
  finalize,
  forkJoin,
  from,
  map,
  of,
  switchMap,
  throwError,
} from 'rxjs';

import {
  CreateTemplateRequest,
  FieldDefinition,
  FieldType,
  TemplateResponse,
} from '#/app/features/config-org/interfaces/plantillas.models';
import { DepartmentService } from '#/app/features/config-org/services/departamento.service';
import { TemplateService } from '#/app/features/config-org/services/plantillas.service';
import {
  EditorAiGeneratePayload,
  EditorAiModalComponent,
} from './components/editor-ai-modal/editor-ai-modal';
import { EditorDebugModalComponent } from './components/editor-debug-modal/editor-debug-modal';
import { EditorHeaderComponent } from './components/editor-header/editor-header';
import {
  EditorNodeInspectorComponent,
  type NodeInspectorSubmitPayload,
} from './components/editor-node-inspector/editor-node-inspector';
import {
  EditorSettingsPopoverComponent,
  type EditorSettingsSubmitPayload,
} from './components/editor-settings-popover/editor-settings-popover';
import { EditorToolbarComponent } from './components/editor-toolbar/editor-toolbar';
import {
  Diagram,
  DiagramAiExistingTemplateContext,
  DiagramAiRequest,
  DiagramAiResponse,
  DiagramAiTemplateSuggestion,
  DiagramCell,
  EditorTool,
} from './interfaces/diagram.models';
import { DiagramAiService } from './services/diagram-ai.service';
import { DiagramEditorCollaborationService } from './services/diagram-editor-collaboration.service';
import { DiagramEditorDragSessionService } from './services/diagram-editor-drag-session.service';
import { DiagramEditorLaneService } from './services/diagram-editor-lane.service';
import { DiagramEditorLockStateService } from './services/diagram-editor-lock-state.service';
import { DiagramEditorMessageHandlerService } from './services/diagram-editor-message-handler.service';
import { DiagramEditorSnapshotStoreService } from './services/diagram-editor-snapshot-store.service';
import { DiagramEditorUiService } from './services/diagram-editor-ui.service';
import { DiagramService } from './services/diagram.service';

@Component({
  selector: 'app-diagram-editor',
  standalone: true,
  imports: [
    CommonModule,
    EditorHeaderComponent,
    EditorToolbarComponent,
    EditorSettingsPopoverComponent,
    EditorNodeInspectorComponent,
    EditorDebugModalComponent,
    EditorAiModalComponent,
  ],
  templateUrl: './diagram-editor.html',
  styleUrl: './diagram-editor.css',
  providers: [
    DiagramEditorUiService,
    DiagramEditorDragSessionService,
    DiagramEditorLaneService,
    DiagramEditorLockStateService,
    DiagramEditorSnapshotStoreService,
    DiagramEditorMessageHandlerService,
    DiagramEditorCollaborationService,
  ],
})
export class DiagramEditor implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('paperHost', { static: true }) paperHost!: ElementRef<HTMLDivElement>;
  @ViewChild('canvasViewport', { static: true }) canvasViewport!: ElementRef<HTMLDivElement>;

  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly diagramService = inject(DiagramService);
  private readonly departmentService = inject(DepartmentService);
  private readonly templateService = inject(TemplateService);
  private readonly diagramAiService = inject(DiagramAiService);

  protected readonly ui = inject(DiagramEditorUiService);
  protected readonly collab = inject(DiagramEditorCollaborationService);

  private isPanning = false;
  private panStartX = 0;
  private panStartY = 0;
  private scrollStartLeft = 0;
  private scrollStartTop = 0;

  private resizingLaneId: string | null = null;
  private resizeStartClientX = 0;
  private resizeStartWidth = 0;

  private draggingLaneId: string | null = null;

  protected readonly isImporting = signal(false);
  protected readonly isExporting = signal(false);

  protected readonly isAiModalOpen = signal(false);
  protected readonly isAiGenerating = signal(false);
  protected readonly isAiApplying = signal(false);
  protected readonly aiResponse = signal<DiagramAiResponse | null>(null);
  protected readonly aiErrorMessage = signal('');

  private readonly fullTemplates = signal<TemplateResponse[]>([]);

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id') || '';
    if (!id) return;

    this.loadDiagram(id);
    this.loadDepartments();
    this.loadTemplates();
    this.collab.initDiagram(id);
  }

  ngAfterViewInit(): void {
    this.collab.attachCanvas(this.paperHost.nativeElement);
  }

  ngOnDestroy(): void {
    this.collab.destroy();
  }

  @HostListener('window:keydown', ['$event'])
  protected onWindowKeyDown(event: KeyboardEvent): void {
    if (this.shouldIgnoreKeyboardShortcut(event)) return;

    if (event.key === 'Escape') {
      event.preventDefault();

      if (this.isAiModalOpen()) {
        this.closeAiModal();
        return;
      }

      this.collab.cancelCurrentAction();
      return;
    }

    if (event.key === 'Delete' || event.key === 'Backspace') {
      event.preventDefault();
      this.collab.deleteSelectedCell();
    }
  }

  protected openDebugModal(): void {
    this.ui.openDebugModal();
  }

  protected closeDebugModal(): void {
    this.ui.closeDebugModal();
  }

  protected toggleSettingsPopover(): void {
    this.ui.toggleSettingsPopover();
  }

  protected closeSettingsPopover(): void {
    this.ui.closeSettingsPopover();
  }

  protected onBackRequested(): void {
    this.router.navigateByUrl('/diagram');
  }

  protected onToolSelected(tool: EditorTool): void {
    this.ui.setActiveTool(tool);
    this.collab.cancelCurrentAction({ clearSelectionInLink: true });
  }

  protected onLaneDepartmentChanged(departmentId: string): void {
    this.ui.setSelectedLaneDepartmentId(departmentId);
  }

  protected onAiRequested(): void {
    this.isAiModalOpen.set(true);
    this.aiErrorMessage.set('');
  }

  protected closeAiModal(): void {
    if (this.isAiGenerating() || this.isAiApplying()) return;

    this.isAiModalOpen.set(false);
    this.aiErrorMessage.set('');
  }

  protected generateAiDiagram(payload: EditorAiGeneratePayload): void {
    if (this.isAiGenerating()) return;

    this.isAiGenerating.set(true);
    this.aiErrorMessage.set('');

    this.buildDiagramAiRequest(payload)
      .pipe(
        switchMap((request) => this.diagramAiService.MESSAGE(request)),
        finalize(() => this.isAiGenerating.set(false)),
      )
      .subscribe({
        next: (response) => {
          this.aiResponse.set(response);

          this.collab.logs.update((current) => [
            `${new Date().toLocaleTimeString()} - Propuesta IA generada en modo ${
              response.mode
            }: ${response.diagram.cells.length} celdas`,
            ...current,
          ]);
        },
        error: (error) => {
          console.error(error);

          const message =
            error?.error?.detail?.message ??
            error?.error?.message ??
            error?.message ??
            'No se pudo generar la propuesta IA.';

          const semanticErrors = error?.error?.detail?.errors;

          const normalizedErrors = Array.isArray(semanticErrors)
            ? semanticErrors
                .map((item: unknown) => {
                  if (typeof item === 'string') {
                    return item;
                  }

                  if (item && typeof item === 'object') {
                    const errorObject = item as {
                      loc?: unknown;
                      msg?: unknown;
                      type?: unknown;
                    };

                    const loc = Array.isArray(errorObject.loc) ? errorObject.loc.join('.') : '';

                    const msg =
                      typeof errorObject.msg === 'string' ? errorObject.msg : JSON.stringify(item);

                    return loc ? `${loc}: ${msg}` : msg;
                  }

                  return String(item);
                })
                .join(' | ')
            : '';

          const fullMessage = normalizedErrors ? `${message}: ${normalizedErrors}` : message;

          this.aiErrorMessage.set(fullMessage);

          this.collab.logs.update((current) => [
            `${new Date().toLocaleTimeString()} - Error IA: ${fullMessage}`,
            ...current,
          ]);
        },
      });
  }

  protected applyAiDiagram(): void {
    const response = this.aiResponse();
    const diagramId = this.collab.diagramId();

    if (!response || !diagramId || this.isAiApplying()) return;

    const confirmed = window.confirm(
      'Esta accion guardara la propuesta generada por IA y reemplazara el diagrama actual. Deseas continuar?',
    );

    if (!confirmed) return;

    this.isAiApplying.set(true);
    this.aiErrorMessage.set('');

    this.createMissingTemplatesFromAi(response)
      .pipe(
        map((createdTemplatesByNodeId) =>
          this.buildDiagramFromAiResponse(response, createdTemplatesByNodeId),
        ),
        map((diagram) => this.buildFlowroadFileFromDiagram(diagram)),
        switchMap((file) => this.diagramService.IMPORT_INTO_CURRENT(diagramId, file)),
        finalize(() => this.isAiApplying.set(false)),
      )
      .subscribe({
        next: (savedDiagram) => {
          this.collab.replaceDiagramFromImport(savedDiagram);
          this.ui.closeSettingsPopover();
          this.isAiModalOpen.set(false);
          this.aiResponse.set(null);
          this.aiErrorMessage.set('');

          this.collab.logs.update((current) => [
            `${new Date().toLocaleTimeString()} - Propuesta IA aceptada y guardada correctamente`,
            ...current,
          ]);

          this.loadTemplates();
        },
        error: (error) => {
          console.error(error);

          const message =
            error?.error?.message ?? error?.error?.detail ?? 'No se pudo guardar la propuesta IA.';

          this.aiErrorMessage.set(String(message));

          this.collab.logs.update((current) => [
            `${new Date().toLocaleTimeString()} - Error al guardar propuesta IA: ${String(
              message,
            )}`,
            ...current,
          ]);
        },
      });
  }

  protected onZoomInRequested(): void {
    this.collab.zoomIn();
  }

  protected onZoomOutRequested(): void {
    this.collab.zoomOut();
  }

  protected onViewportMouseDown(event: MouseEvent): void {
    if (this.resizingLaneId || this.draggingLaneId) return;
    if (this.ui.activeTool() !== 'PAN') return;

    this.isPanning = true;
    this.panStartX = event.clientX;
    this.panStartY = event.clientY;
    this.scrollStartLeft = this.canvasViewport.nativeElement.scrollLeft;
    this.scrollStartTop = this.canvasViewport.nativeElement.scrollTop;
  }

  protected onViewportMouseMove(event: MouseEvent): void {
    const zoom = this.collab.canvasZoom() || 1;

    if (this.resizingLaneId) {
      const deltaX = (event.clientX - this.resizeStartClientX) / zoom;
      this.collab.previewLaneResize(this.resizingLaneId, this.resizeStartWidth + deltaX);
      return;
    }

    if (this.draggingLaneId) {
      const viewportRect = this.canvasViewport.nativeElement.getBoundingClientRect();
      const canvasX =
        (event.clientX - viewportRect.left + this.canvasViewport.nativeElement.scrollLeft) / zoom;

      this.collab.previewLaneReorder(this.draggingLaneId, canvasX);
      return;
    }

    if (!this.isPanning) return;

    const deltaX = event.clientX - this.panStartX;
    const deltaY = event.clientY - this.panStartY;

    this.canvasViewport.nativeElement.scrollLeft = this.scrollStartLeft - deltaX;
    this.canvasViewport.nativeElement.scrollTop = this.scrollStartTop - deltaY;
  }

  protected onViewportMouseUp(): void {
    this.isPanning = false;

    if (this.resizingLaneId) {
      this.collab.commitLaneLayoutChange('Resize colaborativo de lanes');
    }

    if (this.draggingLaneId) {
      this.collab.commitLaneLayoutChange('Reorden colaborativo de lanes');
    }

    this.resizingLaneId = null;
    this.draggingLaneId = null;
  }

  protected onViewportMouseLeave(): void {
    this.isPanning = false;

    if (this.resizingLaneId) {
      this.collab.commitLaneLayoutChange('Resize colaborativo de lanes');
    }

    if (this.draggingLaneId) {
      this.collab.commitLaneLayoutChange('Reorden colaborativo de lanes');
    }

    this.resizingLaneId = null;
    this.draggingLaneId = null;
  }

  protected onLaneResizeStart(event: MouseEvent, laneId: string, currentWidth: number): void {
    event.preventDefault();
    event.stopPropagation();

    this.resizingLaneId = laneId;
    this.resizeStartClientX = event.clientX;
    this.resizeStartWidth = currentWidth;
  }

  protected onLaneHeaderMouseDown(event: MouseEvent, laneId: string): void {
    event.preventDefault();
    event.stopPropagation();

    this.draggingLaneId = laneId;
  }

  protected getSelectedCell(): DiagramCell | null {
    return this.collab.getSelectedCell();
  }

  protected onInspectorSave(payload: NodeInspectorSubmitPayload): void {
    const selectedCell = this.getSelectedCell();
    if (!selectedCell) return;

    if (selectedCell.type === 'standard.Link') {
      this.collab.updateLinkLabel(payload.label);
      this.collab.logs.update((current) => [
        `${new Date().toLocaleTimeString()} - Conector actualizado: ${
          payload.label || '(sin label)'
        }`,
        ...current,
      ]);
      return;
    }

    this.collab.updateNode(payload);
    this.collab.logs.update((current) => [
      `${new Date().toLocaleTimeString()} - Nodo actualizado: ${payload.label}`,
      ...current,
    ]);
  }

  protected onInspectorDelete(): void {
    this.collab.deleteCell();
  }

  protected saveDiagramSettings(payload: EditorSettingsSubmitPayload): void {
    const diagramId = this.collab.diagramId();
    if (!diagramId) return;

    this.ui.saveDiagramSettings(
      diagramId,
      payload,
      () => {
        this.ui.saveDiagramLanes(
          diagramId,
          payload.lanes,
          () => {
            this.collab.logs.update((current) => [
              `${new Date().toLocaleTimeString()} - ConfiguraciÃ³n actualizada: ${
                payload.name
              } | lanes=${payload.lanes.length}`,
              ...current,
            ]);
          },
          () => {
            this.collab.logs.update((current) => [
              `${new Date().toLocaleTimeString()} - Error al guardar lanes del diagrama`,
              ...current,
            ]);
          },
        );
      },
      () => {
        this.collab.logs.update((current) => [
          `${new Date().toLocaleTimeString()} - Error al actualizar nombre/descripciÃ³n`,
          ...current,
        ]);
      },
    );
  }

  protected onExportRequested(): void {
    const diagramId = this.collab.diagramId();
    if (!diagramId || this.isExporting()) return;

    this.isExporting.set(true);

    this.diagramService
      .EXPORT(diagramId)
      .pipe(finalize(() => this.isExporting.set(false)))
      .subscribe({
        next: (blob) => {
          this.downloadFlowroadFile(blob);
          this.collab.logs.update((current) => [
            `${new Date().toLocaleTimeString()} - ExportaciÃ³n .flowroad completada`,
            ...current,
          ]);
        },
        error: (error) => {
          console.error(error);
          this.collab.logs.update((current) => [
            `${new Date().toLocaleTimeString()} - Error al exportar .flowroad`,
            ...current,
          ]);
        },
      });
  }

  protected onImportRequested(file: File): void {
    const diagramId = this.collab.diagramId();
    if (!diagramId || !file || this.isImporting()) return;

    const confirmed = window.confirm(
      'Esta acciÃ³n reemplazarÃ¡ completamente el diagrama actual (nombre, descripciÃ³n, lanes y nodos). Â¿Deseas continuar?',
    );

    if (!confirmed) {
      return;
    }

    this.isImporting.set(true);

    this.diagramService
      .IMPORT_INTO_CURRENT(diagramId, file)
      .pipe(finalize(() => this.isImporting.set(false)))
      .subscribe({
        next: (diagram: Diagram) => {
          console.log('IMPORT RESPONSE', diagram);
          console.log('IMPORT CELLS', diagram.cells);
          console.log('IMPORT LANES', diagram.lanes);
          console.log('IMPORT NAME', diagram.name);
          console.log('IMPORT DESCRIPTION', diagram.description);

          this.collab.replaceDiagramFromImport(diagram);
          this.ui.closeSettingsPopover();
          this.collab.logs.update((current) => [
            `${new Date().toLocaleTimeString()} - ImportaciÃ³n .flowroad completada (${
              diagram.cells?.length ?? 0
            } celdas)`,
            ...current,
          ]);
        },
        error: (error) => {
          console.error(error);
          this.collab.logs.update((current) => [
            `${new Date().toLocaleTimeString()} - Error al importar .flowroad`,
            ...current,
          ]);
        },
      });
  }

  private buildDiagramAiRequest(payload: EditorAiGeneratePayload): Observable<DiagramAiRequest> {
    if (payload.mode === 'CREATE') {
      return of(
        this.buildDiagramAiPayload({
          mode: 'CREATE',
          userMessage: payload.userMessage,
          currentDiagram: null,
        }),
      );
    }

    const diagramId = this.collab.diagramId();

    if (!diagramId) {
      return throwError(() => new Error('No se pudo editar porque no hay un diagrama cargado.'));
    }

    return this.diagramService.EXPORT(diagramId).pipe(
      switchMap((blob) => from(blob.text())),
      map((text) => JSON.parse(text) as Record<string, unknown>),
      map((currentDiagram) =>
        this.buildDiagramAiPayload({
          mode: 'EDIT',
          userMessage: payload.userMessage,
          currentDiagram,
        }),
      ),
    );
  }

  private buildDiagramAiPayload(params: {
    mode: 'CREATE' | 'EDIT';
    userMessage: string;
    currentDiagram: Record<string, unknown> | null;
  }): DiagramAiRequest {
    return {
      mode: params.mode,
      user_message: params.userMessage,
      current_diagram: params.mode === 'EDIT' ? params.currentDiagram : null,
      available_departments: this.ui.availableDepartments().map((department) => ({
        id: department.id,
        name: department.name,
      })),
      existing_templates: this.buildExistingTemplatesForAi(),
    };
  }

  private buildExistingTemplatesForAi(): DiagramAiExistingTemplateContext[] {
    return this.fullTemplates().map((template) => ({
      id: template.id,
      name: template.name,
      description: template.description,
      department_id: template.departmentId,
      department_name: template.departmentName,
      fields: template.fields.map((field) => ({
        field_id: field.fieldId,
        type: field.type,
        label: field.label,
        required: field.required,
        options: field.options ?? [],
        ui_props: {
          grid_cols: field.uiProps?.gridCols ?? 1,
        },
      })),
    }));
  }

  private createMissingTemplatesFromAi(response: DiagramAiResponse) {
    const createSuggestions = response.template_suggestions.filter(
      (suggestion) => suggestion.strategy === 'CREATE_NEW_TEMPLATE' && suggestion.template,
    );

    if (!createSuggestions.length) {
      return of({});
    }

    const requests = createSuggestions.map((suggestion) => {
      const existingTemplate = this.findExistingTemplateForAiSuggestion(suggestion);

      if (existingTemplate) {
        this.collab.logs.update((current) => [
          `${new Date().toLocaleTimeString()} - Plantilla existente reutilizada: ${
            existingTemplate.name
          }`,
          ...current,
        ]);

        return of({
          nodeId: suggestion.node_id,
          template: existingTemplate,
        });
      }

      const payload = this.mapAiTemplateToCreateRequest(suggestion);

      return this.templateService.CREATE(payload).pipe(
        map((createdTemplate) => {
          this.fullTemplates.update((current) => {
            const alreadyExists = current.some((template) => template.id === createdTemplate.id);
            return alreadyExists ? current : [...current, createdTemplate];
          });

          this.refreshAvailableTemplateSummariesFromFullTemplates();

          return {
            nodeId: suggestion.node_id,
            template: createdTemplate,
          };
        }),
        catchError((error) => {
          return this.resolveDuplicatedTemplateAfterCreateError(suggestion, error);
        }),
      );
    });

    return forkJoin(requests).pipe(
      map((items) => {
        return items.reduce<Record<string, TemplateResponse>>((acc, item) => {
          acc[item.nodeId] = item.template;
          return acc;
        }, {});
      }),
    );
  }

  private findExistingTemplateForAiSuggestion(
    suggestion: DiagramAiTemplateSuggestion,
  ): TemplateResponse | null {
    const aiTemplate = suggestion.template;

    if (!aiTemplate) {
      return null;
    }

    const normalizedAiName = this.normalizeTemplateName(aiTemplate.name);
    const aiDepartmentId = aiTemplate.department_id;

    if (!normalizedAiName || !aiDepartmentId) {
      return null;
    }

    return (
      this.fullTemplates().find((template) => {
        const sameName = this.normalizeTemplateName(template.name) === normalizedAiName;
        const sameDepartment = template.departmentId === aiDepartmentId;
        const isActive = template.isActive !== false;

        return sameName && sameDepartment && isActive;
      }) ?? null
    );
  }

  private resolveDuplicatedTemplateAfterCreateError(
    suggestion: DiagramAiTemplateSuggestion,
    originalError: unknown,
  ) {
    return this.templateService.GET_ALL_BY_ORGANIZATION().pipe(
      map((templates) => {
        this.fullTemplates.set(templates);
        this.refreshAvailableTemplateSummariesFromFullTemplates();

        const existingTemplate = this.findExistingTemplateForAiSuggestion(suggestion);

        if (existingTemplate) {
          this.collab.logs.update((current) => [
            `${new Date().toLocaleTimeString()} - Plantilla duplicada detectada y reutilizada: ${
              existingTemplate.name
            }`,
            ...current,
          ]);

          return {
            nodeId: suggestion.node_id,
            template: existingTemplate,
          };
        }

        throw originalError;
      }),
    );
  }

  private refreshAvailableTemplateSummariesFromFullTemplates(): void {
    this.ui.setAvailableTemplates(
      this.fullTemplates().map((template) => ({
        id: template.id,
        name: template.name,
        departmentId: template.departmentId,
        departmentName: template.departmentName,
        isActive: template.isActive,
      })),
    );
  }

  private normalizeTemplateName(value: string | null | undefined): string {
    return String(value ?? '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim()
      .toLowerCase()
      .replace(/\s+/g, ' ');
  }

  private mapAiTemplateToCreateRequest(
    suggestion: DiagramAiTemplateSuggestion,
  ): CreateTemplateRequest {
    const template = suggestion.template;

    if (!template) {
      throw new Error(`La sugerencia ${suggestion.node_id} no tiene template.`);
    }

    return {
      name: template.name,
      description: template.description,
      departmentId: template.department_id,
      fields: template.fields.map((field, index): FieldDefinition => {
        return {
          fieldId: this.generateFieldId(),
          type: field.type as FieldType,
          label: field.label,
          required: field.required,
          isInternalOnly: false,
          options: field.options ?? [],
          uiProps: {
            order: index + 1,
            gridCols: field.ui_props?.grid_cols ?? 1,
            placeholder: '',
          },
          aiSuggestions: [],
        };
      }),
    };
  }

  private buildDiagramFromAiResponse(
    response: DiagramAiResponse,
    createdTemplatesByNodeId: Record<string, TemplateResponse>,
  ): Diagram {
    const diagramId = this.collab.diagramId();
    const now = new Date().toISOString();

    const templateIdByNodeId = response.template_suggestions.reduce<Record<string, string>>(
      (acc, suggestion) => {
        if (
          suggestion.strategy === 'USE_EXISTING_TEMPLATE' &&
          suggestion.existing_template_id &&
          suggestion.existing_template_id.trim()
        ) {
          acc[suggestion.node_id] = suggestion.existing_template_id.trim();
          return acc;
        }

        const createdTemplate = createdTemplatesByNodeId[suggestion.node_id];
        if (createdTemplate?.id) {
          acc[suggestion.node_id] = createdTemplate.id;
        }

        return acc;
      },
      {},
    );

    const cells = response.diagram.cells.map((cell) => {
      if (cell.type === 'standard.Link') return cell;

      const resolvedTemplateId = templateIdByNodeId[cell.id];
      if (!resolvedTemplateId) return cell;

      return {
        ...cell,
        customData: {
          ...(cell.customData ?? {}),
          templateDocumentId: resolvedTemplateId,
        },
      };
    });

    return {
      id: diagramId,
      orgId: '',
      name: response.diagram.name,
      description: response.diagram.description,
      version: 1,
      isActive: true,
      cells,
      lanes: response.diagram.lanes,
      createdAt: now,
      createdBy: '',
      updatedAt: now,
    };
  }

  private buildFlowroadFileFromDiagram(diagram: Diagram): File {
    const safeName =
      diagram.name
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9_-]+/g, '-')
        .replace(/^-+|-+$/g, '') || 'diagrama-ia';

    const flowroadExport = {
      schemaVersion: 1,
      app: 'FlowRoad',
      exportedAt: new Date().toISOString(),
      diagram: {
        name: diagram.name,
        description: diagram.description,
        cells: diagram.cells,
        lanes: diagram.lanes ?? [],
      },
    };

    const blob = new Blob([JSON.stringify(flowroadExport, null, 2)], {
      type: 'application/json',
    });

    return new File([blob], `${safeName}.flowroad`, {
      type: 'application/json',
    });
  }

  private generateFieldId(): string {
    return Math.random().toString(36).slice(2, 9);
  }

  private shouldIgnoreKeyboardShortcut(event: KeyboardEvent): boolean {
    const target = event.target as HTMLElement | null;
    if (!target) return false;

    const tagName = target.tagName?.toLowerCase();
    const isEditable = target.isContentEditable;

    return tagName === 'input' || tagName === 'textarea' || tagName === 'select' || isEditable;
  }

  private loadDiagram(id: string): void {
    this.diagramService.GET_BY_ID(id).subscribe({
      next: (diagram) => {
        this.ui.setMetadata(diagram.name, diagram.description);
        this.ui.setLanes(diagram.lanes);
      },
      error: (error) => {
        console.error(error);
        this.collab.logs.update((current) => [
          `${new Date().toLocaleTimeString()} - Error al cargar metadata/lanes del diagrama`,
          ...current,
        ]);
      },
    });
  }

  private loadDepartments(): void {
    this.departmentService.GET_BY_ORGANIZATION().subscribe({
      next: (departments) => {
        this.ui.setAvailableDepartments(departments);
      },
      error: (error) => {
        console.error(error);
        this.collab.logs.update((current) => [
          `${new Date().toLocaleTimeString()} - Error al cargar departments de la organizaciÃ³n`,
          ...current,
        ]);
      },
    });
  }

  private loadTemplates(): void {
    this.templateService.GET_ALL_BY_ORGANIZATION().subscribe({
      next: (templates) => {
        this.fullTemplates.set(templates);
        this.refreshAvailableTemplateSummariesFromFullTemplates();
      },
      error: (error) => {
        console.error(error);
        this.collab.logs.update((current) => [
          `${new Date().toLocaleTimeString()} - Error al cargar plantillas de la organizaciÃ³n`,
          ...current,
        ]);
      },
    });
  }

  private downloadFlowroadFile(blob: Blob): void {
    const objectUrl = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    const safeName = this.ui
      .diagramName()
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_-]+/g, '-')
      .replace(/^-+|-+$/g, '');

    link.href = objectUrl;
    link.download = `${safeName || 'diagrama'}.flowroad`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(objectUrl);
  }
}
