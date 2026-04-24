import { Injectable } from '@angular/core';

@Injectable()
export class DiagramEditorLockStateService {
  private readonly localLockedCellIds = new Set<string>();
  private readonly remoteLockedCellIds = new Set<string>();
  private readonly preDragPositions = new Map<string, { x: number; y: number }>();

  isLocallyLocked(cellId: string): boolean {
    return this.localLockedCellIds.has(cellId);
  }

  isRemotelyLocked(cellId: string): boolean {
    return this.remoteLockedCellIds.has(cellId);
  }

  markLocallyLocked(cellId: string): void {
    this.localLockedCellIds.add(cellId);
  }

  markRemotelyLocked(cellId: string): void {
    this.remoteLockedCellIds.add(cellId);
  }

  clearLocalLock(cellId: string): void {
    this.localLockedCellIds.delete(cellId);
  }

  clearRemoteLock(cellId: string): void {
    this.remoteLockedCellIds.delete(cellId);
  }

  clearAllLocksForCell(cellId: string): void {
    this.localLockedCellIds.delete(cellId);
    this.remoteLockedCellIds.delete(cellId);
  }

  rememberPreDragPosition(cellId: string, position: { x: number; y: number }): void {
    this.preDragPositions.set(cellId, position);
  }

  getPreDragPosition(cellId: string): { x: number; y: number } | undefined {
    return this.preDragPositions.get(cellId);
  }

  clearPreDragPosition(cellId: string): void {
    this.preDragPositions.delete(cellId);
  }

  reset(): void {
    this.localLockedCellIds.clear();
    this.remoteLockedCellIds.clear();
    this.preDragPositions.clear();
  }
}