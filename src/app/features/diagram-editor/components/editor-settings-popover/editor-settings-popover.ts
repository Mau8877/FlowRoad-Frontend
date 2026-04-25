import { DepartmentResponse } from '#/app/features/config-org/interfaces/departamentos.model';
import { CommonModule } from '@angular/common';
import {
  Component,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DiagramLane } from '../../interfaces/diagram.models';

export interface EditorSettingsSubmitPayload {
  name: string;
  description: string;
  lanes: DiagramLane[];
}

@Component({
  selector: 'app-editor-settings-popover',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './editor-settings-popover.html',
  styleUrl: './editor-settings-popover.css',
})
export class EditorSettingsPopoverComponent implements OnChanges {
  @Input() isOpen = false;
  @Input() currentName = '';
  @Input() currentDescription = '';
  @Input() currentLanes: DiagramLane[] = [];
  @Input() availableDepartments: DepartmentResponse[] = [];
  @Input() isSaving = false;

  @Output() closeRequested = new EventEmitter<void>();
  @Output() saveRequested = new EventEmitter<EditorSettingsSubmitPayload>();

  public draftName = signal('');
  public draftDescription = signal('');
  public draftLanes = signal<DiagramLane[]>([]);

  ngOnChanges(changes: SimpleChanges): void {
    if (
      changes['currentName'] ||
      changes['currentDescription'] ||
      changes['currentLanes'] ||
      changes['isOpen']
    ) {
      this.resetDrafts();
    }
  }

  onClose(): void {
    this.closeRequested.emit();
  }

  onSave(): void {
    const name = this.draftName().trim();
    const description = this.draftDescription().trim();

    if (!name) return;

    this.saveRequested.emit({
      name,
      description,
      lanes: this.draftLanes(),
    });
  }

  onAddDepartment(department: DepartmentResponse): void {
    const exists = this.draftLanes().some((lane) => lane.departmentId === department.id);
    if (exists) return;

    const nextLane: DiagramLane = {
      id: `lane-${department.id}`,
      departmentId: department.id,
      departmentName: department.name,
      order: this.draftLanes().length,
      x: 80,
      y: 80,
      width: 320,
      height: 720,
    };

    this.draftLanes.update((lanes) => [...lanes, nextLane]);
  }

  onRemoveLane(laneId: string): void {
    this.draftLanes.update((lanes) =>
      lanes
        .filter((lane) => lane.id !== laneId)
        .map((lane, index) => ({
          ...lane,
          order: index,
        })),
    );
  }

  onMoveLaneUp(laneId: string): void {
    const lanes = [...this.draftLanes()];
    const index = lanes.findIndex((lane) => lane.id === laneId);
    if (index <= 0) return;

    [lanes[index - 1], lanes[index]] = [lanes[index], lanes[index - 1]];

    this.draftLanes.set(
      lanes.map((lane, idx) => ({
        ...lane,
        order: idx,
      })),
    );
  }

  onMoveLaneDown(laneId: string): void {
    const lanes = [...this.draftLanes()];
    const index = lanes.findIndex((lane) => lane.id === laneId);
    if (index < 0 || index >= lanes.length - 1) return;

    [lanes[index], lanes[index + 1]] = [lanes[index + 1], lanes[index]];

    this.draftLanes.set(
      lanes.map((lane, idx) => ({
        ...lane,
        order: idx,
      })),
    );
  }

  isDepartmentAlreadyAdded(departmentId: string): boolean {
    return this.draftLanes().some((lane) => lane.departmentId === departmentId);
  }

  private resetDrafts(): void {
    this.draftName.set(this.currentName ?? '');
    this.draftDescription.set(this.currentDescription ?? '');
    this.draftLanes.set(
      [...(this.currentLanes ?? [])]
        .sort((a, b) => a.order - b.order)
        .map((lane) => ({
          ...lane,
          x: lane.x ?? 80,
          y: lane.y ?? 80,
          width: lane.width ?? 320,
          height: lane.height ?? 720,
        })),
    );
  }
}
