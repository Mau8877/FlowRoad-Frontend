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

import { EditorDebugModalComponent } from './components/editor-debug-modal/editor-debug-modal';
import { EditorHeaderComponent } from './components/editor-header/editor-header';
import { EditorMinimapComponent } from './components/editor-minimap/editor-minimap';
import {
  EditorSettingsPopoverComponent,
  type EditorSettingsSubmitPayload,
} from './components/editor-settings-popover/editor-settings-popover';
import { DiagramEditorCollaborationService } from './services/diagram-editor-collaboration.service';
import { DiagramEditorUiService } from './services/diagram-editor-ui.service';

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

  protected readonly ui = inject(DiagramEditorUiService);
  protected readonly collab = inject(DiagramEditorCollaborationService);

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id') || '';
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
    this.ui.saveDiagramSettings(
      this.collab.diagramId(),
      payload,
      () => {
        this.collab.logs.update((current) => [
          `${new Date().toLocaleTimeString()} - Metadata actualizada: ${payload.name}`,
          ...current,
        ]);
      },
      () => {
        this.collab.logs.update((current) => [
          `${new Date().toLocaleTimeString()} - Error al actualizar nombre/descripción`,
          ...current,
        ]);
      },
    );
  }
}
