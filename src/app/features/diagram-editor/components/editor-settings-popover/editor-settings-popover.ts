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
import { DepartmentResponse } from '#/app/features/config-org/interfaces/departamentos.model';
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
    const lanes = [...this.draftLanes()].map((lane, index) => ({
      ...lane,
      order: index,
    }));

    if (!name) return;

    this.saveRequested.emit({
      name,
      description,
      lanes,
    });
  }

  addLaneFromDepartment(department: DepartmentResponse): void {
    const alreadyExists = this.draftLanes().some((lane) => lane.departmentId === department.id);
    if (alreadyExists) return;

    this.draftLanes.update((current) => [
      ...current,
      {
        id: `lane-${department.id}`,
        departmentId: department.id,
        departmentName: department.name,
        order: current.length,
      },
    ]);
  }

  removeLane(laneId: string): void {
    this.draftLanes.update((current) =>
      current
        .filter((lane) => lane.id !== laneId)
        .map((lane, index) => ({
          ...lane,
          order: index,
        })),
    );
  }

  moveLaneUp(laneId: string): void {
    const current = [...this.draftLanes()];
    const index = current.findIndex((lane) => lane.id === laneId);
    if (index <= 0) return;

    [current[index - 1], current[index]] = [current[index], current[index - 1]];

    this.draftLanes.set(
      current.map((lane, idx) => ({
        ...lane,
        order: idx,
      })),
    );
  }

  moveLaneDown(laneId: string): void {
    const current = [...this.draftLanes()];
    const index = current.findIndex((lane) => lane.id === laneId);
    if (index === -1 || index >= current.length - 1) return;

    [current[index], current[index + 1]] = [current[index + 1], current[index]];

    this.draftLanes.set(
      current.map((lane, idx) => ({
        ...lane,
        order: idx,
      })),
    );
  }

  isDepartmentAlreadyUsed(departmentId: string): boolean {
    return this.draftLanes().some((lane) => lane.departmentId === departmentId);
  }

  trackDepartment(_index: number, department: DepartmentResponse): string {
    return department.id;
  }

  trackLane(_index: number, lane: DiagramLane): string {
    return lane.id;
  }

  private resetDrafts(): void {
    this.draftName.set(this.currentName ?? '');
    this.draftDescription.set(this.currentDescription ?? '');
    this.draftLanes.set(
      [...(this.currentLanes ?? [])]
        .sort((a, b) => a.order - b.order)
        .map((lane, index) => ({
          ...lane,
          order: index,
        })),
    );
  }
}