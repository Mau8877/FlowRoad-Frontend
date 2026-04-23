import { Injectable, computed, inject, signal } from '@angular/core';
import { DepartmentResponse } from '#/app/features/config-org/interfaces/departamentos.model';
import { EditorSettingsSubmitPayload } from '../components/editor-settings-popover/editor-settings-popover';
import { DiagramLane } from '../interfaces/diagram.models';
import { DiagramService } from './diagram.service';

@Injectable()
export class DiagramEditorUiService {
  private readonly diagramService = inject(DiagramService);

  public readonly laneWidthPx = 320;
  public readonly laneHeaderHeightPx = 56;
  public readonly minCanvasWidthPx = 1600;
  public readonly minCanvasHeightPx = 900;

  public diagramName = signal('Diagrama de actividades');
  public diagramDescription = signal('');
  public lanes = signal<DiagramLane[]>([]);
  public availableDepartments = signal<DepartmentResponse[]>([]);

  public isSettingsOpen = signal(false);
  public isDebugOpen = signal(false);
  public isSavingSettings = signal(false);

  public canvasWidthPx = computed(() => {
    const laneCount = this.lanes().length;
    const lanesWidth = laneCount * this.laneWidthPx;
    return Math.max(this.minCanvasWidthPx, lanesWidth);
  });

  public canvasHeightPx = computed(() => {
    return this.minCanvasHeightPx;
  });

  openDebugModal(): void {
    this.isDebugOpen.set(true);
  }

  closeDebugModal(): void {
    this.isDebugOpen.set(false);
  }

  toggleSettingsPopover(): void {
    this.isSettingsOpen.update((value) => !value);
  }

  closeSettingsPopover(): void {
    this.isSettingsOpen.set(false);
  }

  setMetadata(name: string, description: string): void {
    this.diagramName.set(name || 'Diagrama de actividades');
    this.diagramDescription.set(description || '');
  }

  setLanes(lanes: DiagramLane[] | null | undefined): void {
    const normalized = [...(lanes ?? [])].sort((a, b) => a.order - b.order);
    this.lanes.set(normalized);
  }

  setAvailableDepartments(departments: DepartmentResponse[] | null | undefined): void {
    const normalized = [...(departments ?? [])]
      .filter((dept) => dept.isActive)
      .sort((a, b) => a.name.localeCompare(b.name));
    this.availableDepartments.set(normalized);
  }

  saveDiagramSettings(
    diagramId: string,
    payload: EditorSettingsSubmitPayload,
    onSuccess?: () => void,
    onError?: () => void,
  ): void {
    this.isSavingSettings.set(true);

    this.diagramService.UPDATE_METADATA(diagramId, payload.name, payload.description).subscribe({
      next: () => {
        this.diagramName.set(payload.name);
        this.diagramDescription.set(payload.description);
        this.isSavingSettings.set(false);
        onSuccess?.();
      },
      error: (error) => {
        console.error(error);
        this.isSavingSettings.set(false);
        onError?.();
      },
    });
  }

  saveDiagramLanes(
    diagramId: string,
    lanes: DiagramLane[],
    onSuccess?: () => void,
    onError?: () => void,
  ): void {
    this.isSavingSettings.set(true);

    const normalized = [...lanes]
      .map((lane, index) => ({
        ...lane,
        order: index,
      }))
      .sort((a, b) => a.order - b.order);

    this.diagramService.UPDATE_LANES(diagramId, normalized).subscribe({
      next: (diagram) => {
        this.setLanes(diagram.lanes);
        this.isSavingSettings.set(false);
        this.isSettingsOpen.set(false);
        onSuccess?.();
      },
      error: (error) => {
        console.error(error);
        this.isSavingSettings.set(false);
        onError?.();
      },
    });
  }
}