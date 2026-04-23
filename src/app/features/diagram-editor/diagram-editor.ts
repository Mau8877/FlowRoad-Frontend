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
import { EditorDebugModalComponent } from './components/editor-debug-modal/editor-debug-modal';
import { EditorHeaderComponent } from './components/editor-header/editor-header';
import { EditorMinimapComponent } from './components/editor-minimap/editor-minimap';
import {
  EditorSettingsPopoverComponent,
  type EditorSettingsSubmitPayload,
} from './components/editor-settings-popover/editor-settings-popover';
import { DiagramEditorCollaborationService } from './services/diagram-editor-collaboration.service';
import { DiagramEditorUiService } from './services/diagram-editor-ui.service';
import { DiagramService } from './services/diagram.service';

@Component({
  selector: 'app-diagram-editor',
  standalone: true,
  imports: [
    CommonModule,
    EditorHeaderComponent,
    EditorSettingsPopoverComponent,
    EditorDebugModalComponent,
    EditorMinimapComponent,
  ],
  templateUrl: './diagram-editor.html',
  styleUrl: './diagram-editor.css',
  providers: [DiagramEditorUiService, DiagramEditorCollaborationService],
})
export class DiagramEditor implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('paperHost', { static: true }) paperHost!: ElementRef<HTMLDivElement>;

  private readonly route = inject(ActivatedRoute);
  private readonly diagramService = inject(DiagramService);
  private readonly departmentService = inject(DepartmentService);

  protected readonly ui = inject(DiagramEditorUiService);
  protected readonly collab = inject(DiagramEditorCollaborationService);

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id') || '';
    if (!id) return;

    this.loadDiagram(id);
    this.loadDepartments();
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
}