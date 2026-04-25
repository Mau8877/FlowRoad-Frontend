import { DepartmentResponse } from '#/app/features/config-org/interfaces/departamentos.model';
import { TemplateSummaryResponse } from '#/app/features/config-org/interfaces/plantillas.models';
import { Injectable, computed, inject, signal } from '@angular/core';
import { EditorSettingsSubmitPayload } from '../components/editor-settings-popover/editor-settings-popover';
import { DiagramLane, EditorTool } from '../interfaces/diagram.models';
import { DiagramService } from './diagram.service';

@Injectable()
export class DiagramEditorUiService {
  private readonly diagramService = inject(DiagramService);

  public readonly defaultLaneWidthPx = 320;
  public readonly minLaneWidthPx = 220;
  public readonly maxLaneWidthPx = 720;
  public readonly defaultLaneHeightPx = 720;
  public readonly defaultLaneStartX = 80;
  public readonly defaultLaneStartY = 80;
  public readonly laneHeaderHeightPx = 56;
  public readonly laneAutoBottomPaddingPx = 80;
  public readonly minCanvasWidthPx = 1600;
  public readonly minCanvasHeightPx = 900;

  public diagramName = signal('Diagrama de actividades');
  public diagramDescription = signal('');
  public lanes = signal<DiagramLane[]>([]);
  public availableDepartments = signal<DepartmentResponse[]>([]);
  public availableTemplates = signal<TemplateSummaryResponse[]>([]);
  public activeTool = signal<EditorTool>('PAN');
  public selectedLaneDepartmentId = signal('');

  public isSettingsOpen = signal(false);
  public isDebugOpen = signal(false);
  public isSavingSettings = signal(false);

  public canvasWidthPx = computed(() => {
    const laneRight = this.lanes().reduce(
      (max, lane) => Math.max(max, lane.x + lane.width + 120),
      0,
    );
    return Math.max(this.minCanvasWidthPx, laneRight);
  });

  public canvasHeightPx = computed(() => {
    const laneBottom = this.lanes().reduce(
      (max, lane) => Math.max(max, lane.y + lane.height + 120),
      0,
    );
    return Math.max(this.minCanvasHeightPx, laneBottom);
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

  setActiveTool(tool: EditorTool): void {
    this.activeTool.set(tool);
  }

  setSelectedLaneDepartmentId(departmentId: string): void {
    this.selectedLaneDepartmentId.set(departmentId);
  }

  setMetadata(name: string, description: string): void {
    this.diagramName.set(name || 'Diagrama de actividades');
    this.diagramDescription.set(description || '');
  }

  setLanes(lanes: DiagramLane[] | null | undefined): void {
    const normalized = this.normalizeConnectedLanes(
      [...(lanes ?? [])].map((lane, index) => ({
        ...lane,
        order: lane.order ?? index,
        x: Number(lane.x ?? this.defaultLaneStartX),
        y: Number(lane.y ?? this.defaultLaneStartY),
        width: this.clampLaneWidth(lane.width),
        height: this.clampLaneHeight(lane.height),
      })),
    );

    this.lanes.set(normalized);
  }

  replaceLanes(lanes: DiagramLane[]): void {
    this.lanes.set(this.normalizeConnectedLanes(lanes));
  }

  addLaneFromDepartment(department: DepartmentResponse): DiagramLane | null {
    const exists = this.lanes().some((lane) => lane.departmentId === department.id);
    if (exists) return null;

    const current = [...this.lanes()];

    const nextLane: DiagramLane = {
      id: `lane-${department.id}`,
      departmentId: department.id,
      departmentName: department.name,
      order: current.length,
      x: this.defaultLaneStartX,
      y: this.defaultLaneStartY,
      width: this.defaultLaneWidthPx,
      height: this.defaultLaneHeightPx,
    };

    const normalized = this.normalizeConnectedLanes([...current, nextLane]);
    this.lanes.set(normalized);

    return normalized.find((lane) => lane.id === nextLane.id) ?? null;
  }

  resizeLaneWidth(laneId: string, width: number): DiagramLane[] {
    const updated = this.lanes().map((lane) =>
      lane.id === laneId
        ? {
            ...lane,
            width: this.clampLaneWidth(width),
          }
        : lane,
    );

    const normalized = this.normalizeConnectedLanes(updated);
    this.lanes.set(normalized);
    return normalized;
  }

  reorderLaneByPointer(laneId: string, pointerCanvasX: number): DiagramLane[] {
    const lanes = [...this.lanes()].sort((a, b) => a.order - b.order);
    const dragged = lanes.find((lane) => lane.id === laneId);
    if (!dragged) return this.lanes();

    const others = lanes.filter((lane) => lane.id !== laneId);

    let targetIndex = 0;
    for (const lane of others) {
      const center = lane.x + lane.width / 2;
      if (pointerCanvasX > center) {
        targetIndex++;
      }
    }

    const reordered = [...others];
    reordered.splice(targetIndex, 0, dragged);

    const normalized = this.normalizeConnectedLanes(reordered);
    this.lanes.set(normalized);
    return normalized;
  }

  applyAutoHeightsFromNodeBottoms(nodeBottomsByLaneId: Record<string, number>): DiagramLane[] {
    const lanes = this.lanes();
    if (lanes.length === 0) {
      return [];
    }

    let globalRequiredHeight = this.defaultLaneHeightPx;

    for (const lane of lanes) {
      const maxNodeBottom = nodeBottomsByLaneId[lane.id];
      if (maxNodeBottom === undefined) continue;

      const requiredHeight = Math.max(
        this.defaultLaneHeightPx,
        Math.ceil(maxNodeBottom - lane.y + this.laneAutoBottomPaddingPx),
      );

      globalRequiredHeight = Math.max(globalRequiredHeight, requiredHeight);
    }

    const clampedGlobalHeight = this.clampLaneHeight(globalRequiredHeight);

    const updated = lanes.map((lane) => ({
      ...lane,
      height: clampedGlobalHeight,
    }));

    const normalized = this.normalizeConnectedLanes(updated);
    this.lanes.set(normalized);
    return normalized;
  }

  getLaneWidth(lane: DiagramLane): number {
    return this.clampLaneWidth(lane.width);
  }

  setAvailableDepartments(departments: DepartmentResponse[] | null | undefined): void {
    const normalized = [...(departments ?? [])]
      .filter((dept) => dept.isActive)
      .sort((a, b) => a.name.localeCompare(b.name));
    this.availableDepartments.set(normalized);
  }

  getDepartmentById(departmentId: string): DepartmentResponse | null {
    return this.availableDepartments().find((dept) => dept.id === departmentId) ?? null;
  }

  setAvailableTemplates(templates: TemplateSummaryResponse[] | null | undefined): void {
    const normalized = [...(templates ?? [])]
      .filter((template) => template.isActive)
      .sort((a, b) => a.name.localeCompare(b.name));
    this.availableTemplates.set(normalized);
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

    const normalized = this.normalizeConnectedLanes(
      [...lanes].map((lane, index) => ({
        ...lane,
        order: index,
        width: this.clampLaneWidth(lane.width),
        height: this.clampLaneHeight(lane.height),
      })),
    );

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

  public normalizeConnectedLanes(lanes: DiagramLane[]): DiagramLane[] {
    if (lanes.length === 0) return [];

    const sorted = [...lanes].sort((a, b) => a.order - b.order);
    const commonY = Number(sorted[0].y ?? this.defaultLaneStartY);

    let currentX = this.defaultLaneStartX;

    return sorted.map((lane, index) => {
      const width = this.clampLaneWidth(lane.width);
      const height = this.clampLaneHeight(lane.height);

      const normalized: DiagramLane = {
        ...lane,
        order: index,
        x: currentX,
        y: commonY,
        width,
        height,
      };

      currentX += width;
      return normalized;
    });
  }

  private clampLaneWidth(width?: number): number {
    const safe = Number(width ?? this.defaultLaneWidthPx);
    return Math.min(this.maxLaneWidthPx, Math.max(this.minLaneWidthPx, safe));
  }

  private clampLaneHeight(height?: number): number {
    const safe = Number(height ?? this.defaultLaneHeightPx);
    return Math.max(this.defaultLaneHeightPx, safe);
  }
}
