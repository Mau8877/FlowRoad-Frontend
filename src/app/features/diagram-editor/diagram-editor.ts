import { CommonModule } from '@angular/common';
import {
  AfterViewInit,
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  ViewChild,
  inject,
} from '@angular/core';
import { ActivatedRoute } from '@angular/router';

import { DepartmentService } from '#/app/features/config-org/services/departamento.service';
import { TemplateService } from '#/app/features/config-org/services/plantillas.service';
import { EditorDebugModalComponent } from './components/editor-debug-modal/editor-debug-modal';
import { EditorHeaderComponent } from './components/editor-header/editor-header';
import { EditorMinimapComponent } from './components/editor-minimap/editor-minimap';
import { EditorNodeInspectorComponent } from './components/editor-node-inspector/editor-node-inspector';
import {
  EditorSettingsPopoverComponent,
  type EditorSettingsSubmitPayload,
} from './components/editor-settings-popover/editor-settings-popover';
import { EditorToolbarComponent } from './components/editor-toolbar/editor-toolbar';
import { DiagramCell, EditorTool } from './interfaces/diagram.models';
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
    EditorMinimapComponent,
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
  private readonly diagramService = inject(DiagramService);
  private readonly departmentService = inject(DepartmentService);
  private readonly templateService = inject(TemplateService);

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

  protected onToolSelected(tool: EditorTool): void {
    this.ui.setActiveTool(tool);
  }

  protected onLaneDepartmentChanged(departmentId: string): void {
    this.ui.setSelectedLaneDepartmentId(departmentId);
  }

  protected onAiRequested(): void {
    this.collab.logs.update((current) => [
      `${new Date().toLocaleTimeString()} - IA aún no implementada, pero el botón ya está listo 😎`,
      ...current,
    ]);
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
    if (this.resizingLaneId) {
      const deltaX = event.clientX - this.resizeStartClientX;
      this.ui.resizeLaneWidth(this.resizingLaneId, this.resizeStartWidth + deltaX);
      return;
    }

    if (this.draggingLaneId) {
      const viewportRect = this.canvasViewport.nativeElement.getBoundingClientRect();
      const canvasX =
        event.clientX - viewportRect.left + this.canvasViewport.nativeElement.scrollLeft;

      this.ui.reorderLaneByPointer(this.draggingLaneId, canvasX);
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
      const laneId = this.resizingLaneId;
      this.resizingLaneId = null;
      this.persistLanes(`Lane redimensionada: ${laneId}`);
    }

    if (this.draggingLaneId) {
      const laneId = this.draggingLaneId;
      this.draggingLaneId = null;
      this.persistLanes(`Lane reordenada: ${laneId}`);
    }
  }

  protected onViewportMouseLeave(): void {
    this.isPanning = false;

    if (this.resizingLaneId) {
      const laneId = this.resizingLaneId;
      this.resizingLaneId = null;
      this.persistLanes(`Lane redimensionada: ${laneId}`);
    }

    if (this.draggingLaneId) {
      const laneId = this.draggingLaneId;
      this.draggingLaneId = null;
      this.persistLanes(`Lane reordenada: ${laneId}`);
    }
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

  protected onInspectorSave(payload: {
    label: string;
    width: number;
    height: number;
    templateDocumentId: string;
  }): void {
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
              `${new Date().toLocaleTimeString()} - Configuración actualizada: ${payload.name} | lanes=${payload.lanes.length}`,
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
          `${new Date().toLocaleTimeString()} - Error al actualizar nombre/descripción`,
          ...current,
        ]);
      },
    );
  }

  private persistLanes(successLog: string): void {
    const diagramId = this.collab.diagramId();
    if (!diagramId) return;

    this.ui.saveDiagramLanes(
      diagramId,
      this.ui.lanes(),
      () => {
        this.collab.logs.update((current) => [
          `${new Date().toLocaleTimeString()} - ${successLog}`,
          ...current,
        ]);
      },
      () => {
        this.collab.logs.update((current) => [
          `${new Date().toLocaleTimeString()} - Error al guardar lanes`,
          ...current,
        ]);
      },
    );
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
          `${new Date().toLocaleTimeString()} - Error al cargar departments de la organización`,
          ...current,
        ]);
      },
    });
  }

  private loadTemplates(): void {
    this.templateService.GET_SUMMARY_BY_MY_ORGANIZATION().subscribe({
      next: (templates) => {
        this.ui.setAvailableTemplates(templates);
      },
      error: (error) => {
        console.error(error);
        this.collab.logs.update((current) => [
          `${new Date().toLocaleTimeString()} - Error al cargar plantillas de la organización`,
          ...current,
        ]);
      },
    });
  }
}
