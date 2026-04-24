import { Injectable } from '@angular/core';

export type DragPhase = 'idle' | 'locking' | 'dragging' | 'committing';

@Injectable()
export class DiagramEditorDragSessionService {
  private draggingCellId: string | null = null;
  private activeDragId: string | null = null;
  private dragPhase: DragPhase = 'idle';

  private pendingLockCellId: string | null = null;
  private pendingLockDragId: string | null = null;

  private pendingReleaseWhileLocking = false;
  private pendingReleasePosition: { x: number; y: number } | null = null;

  get currentDraggingCellId(): string | null {
    return this.draggingCellId;
  }

  get currentActiveDragId(): string | null {
    return this.activeDragId;
  }

  get currentPhase(): DragPhase {
    return this.dragPhase;
  }

  get hasPendingRelease(): boolean {
    return this.pendingReleaseWhileLocking;
  }

  get isIdle(): boolean {
    return this.dragPhase === 'idle';
  }

  shouldBlockNewDrag(): boolean {
    return (
      this.dragPhase !== 'idle' ||
      this.draggingCellId !== null ||
      this.pendingLockCellId !== null ||
      this.activeDragId !== null
    );
  }

  isTransitionLocked(): boolean {
    return this.shouldBlockNewDrag();
  }

  beginLock(cellId: string, dragId: string): void {
    this.draggingCellId = cellId;
    this.activeDragId = dragId;
    this.pendingLockCellId = cellId;
    this.pendingLockDragId = dragId;
    this.dragPhase = 'locking';
    this.pendingReleaseWhileLocking = false;
    this.pendingReleasePosition = null;
  }

  isLockingForCell(cellId: string): boolean {
    return this.dragPhase === 'locking' && this.draggingCellId === cellId;
  }

  matchesPendingLock(cellId: string, dragId: string | null): boolean {
    return this.pendingLockCellId === cellId && this.pendingLockDragId === dragId;
  }

  confirmLocked(cellId: string, dragId: string | null): void {
    this.draggingCellId = cellId;
    this.activeDragId = dragId;
    this.dragPhase = 'dragging';
    this.pendingLockCellId = null;
    this.pendingLockDragId = null;
  }

  matchesActive(cellId: string, dragId: string | null): boolean {
    return this.draggingCellId === cellId && this.activeDragId === dragId;
  }

  isDraggingCell(cellId: string): boolean {
    return this.draggingCellId === cellId;
  }

  canCommit(cellId: string, dragId: string): boolean {
    return this.draggingCellId === cellId && this.activeDragId === dragId && this.dragPhase === 'dragging';
  }

  markCommitting(): void {
    this.dragPhase = 'committing';
  }

  bufferRelease(position: { x: number; y: number } | null): void {
    this.pendingReleaseWhileLocking = true;
    this.pendingReleasePosition = position;
  }

  consumePendingRelease(): { x: number; y: number } | null {
    const value = this.pendingReleasePosition;
    this.pendingReleaseWhileLocking = false;
    this.pendingReleasePosition = null;
    return value;
  }

  reset(): void {
    this.draggingCellId = null;
    this.activeDragId = null;
    this.dragPhase = 'idle';
    this.pendingLockCellId = null;
    this.pendingLockDragId = null;
    this.pendingReleaseWhileLocking = false;
    this.pendingReleasePosition = null;
  }
}