import { Injectable, inject } from '@angular/core';

import { SocketOperationMessage } from '../interfaces/diagram.models';
import { EditorCanvasManager } from '../utils/editor-canvas.manager';
import { DiagramEditorDragSessionService } from './diagram-editor-drag-session.service';
import { DiagramEditorLockStateService } from './diagram-editor-lock-state.service';
import { DiagramEditorSnapshotStoreService } from './diagram-editor-snapshot-store.service';

export interface DiagramEditorMessageHandlerContext {
  currentUserId: string;
  selectedCellId: string;
  canvasManager?: EditorCanvasManager;
  addLog: (message: string) => void;
}

export interface DiagramEditorMessageHandlerResult {
  finishDragPosition?: { x: number; y: number } | null;
  shouldResetDrag?: boolean;
  shouldClearSelectedCell?: boolean;
}

@Injectable()
export class DiagramEditorMessageHandlerService {
  private readonly dragSession = inject(DiagramEditorDragSessionService);
  private readonly lockState = inject(DiagramEditorLockStateService);
  private readonly snapshotStore = inject(DiagramEditorSnapshotStoreService);

  handleIncomingMessage(
    msg: SocketOperationMessage,
    context: DiagramEditorMessageHandlerContext,
  ): DiagramEditorMessageHandlerResult {
    switch (msg.opType) {
      case 'LOCK_CELL':
        return this.handleLockMessage(msg, context);

      case 'UNLOCK_CELL':
        return this.handleUnlockMessage(msg, context);

      case 'LOCK_REJECTED':
        return this.handleLockRejected(msg, context);

      case 'CREATE_NODE':
      case 'CREATE_LINK':
        return this.handleCreateMessage(msg, context);

      case 'MOVE_LIVE':
      case 'MOVE_COMMIT':
        return this.handleMoveMessage(msg, context);

      case 'UPDATE_NODE':
      case 'UPDATE_LINK':
        return this.handleUpdateMessage(msg, context);

      case 'DELETE_CELL':
      case 'DELETE_LINK':
        return this.handleDeleteMessage(msg, context);

      default:
        return {};
    }
  }

  private handleLockMessage(
    msg: SocketOperationMessage,
    context: DiagramEditorMessageHandlerContext,
  ): DiagramEditorMessageHandlerResult {
    const cellId = msg.cellId;
    const dragId = msg.dragId ?? null;

    if (msg.userId === context.currentUserId) {
      if (!this.dragSession.matchesPendingLock(cellId, dragId)) {
        return {};
      }

      this.lockState.markLocallyLocked(cellId);
      this.lockState.clearRemoteLock(cellId);
      this.dragSession.confirmLocked(cellId, dragId);

      context.canvasManager?.paintLockState(cellId, 'local');

      if (this.dragSession.hasPendingRelease) {
        return {
          finishDragPosition: this.dragSession.consumePendingRelease(),
        };
      }

      return {};
    }

    this.lockState.markRemotelyLocked(cellId);
    this.lockState.clearLocalLock(cellId);
    context.canvasManager?.paintLockState(cellId, 'remote');

    return {};
  }

  private handleUnlockMessage(
    msg: SocketOperationMessage,
    context: DiagramEditorMessageHandlerContext,
  ): DiagramEditorMessageHandlerResult {
    const cellId = msg.cellId;
    const dragId = msg.dragId ?? null;

    this.lockState.clearAllLocksForCell(cellId);

    const snapshotCell = this.snapshotStore.findCell(cellId);
    context.canvasManager?.clearLockState(snapshotCell);

    this.lockState.clearPreDragPosition(cellId);

    if (msg.userId === context.currentUserId) {
      if (
        this.dragSession.matchesActive(cellId, dragId) ||
        this.dragSession.matchesPendingLock(cellId, dragId)
      ) {
        this.dragSession.reset();
        return { shouldResetDrag: true };
      }
    }

    return {};
  }

  private handleLockRejected(
    msg: SocketOperationMessage,
    context: DiagramEditorMessageHandlerContext,
  ): DiagramEditorMessageHandlerResult {
    if (msg.userId !== context.currentUserId) return {};
    if (!this.dragSession.matchesPendingLock(msg.cellId, msg.dragId ?? null)) return {};

    this.lockState.clearLocalLock(msg.cellId);

    const previousPosition = this.lockState.getPreDragPosition(msg.cellId);
    if (previousPosition) {
      context.canvasManager?.restoreElementPosition(
        msg.cellId,
        previousPosition.x,
        previousPosition.y,
      );
      this.snapshotStore.updateCellPosition(msg.cellId, previousPosition.x, previousPosition.y);
    }

    const snapshotCell = this.snapshotStore.findCell(msg.cellId);
    context.canvasManager?.clearLockState(snapshotCell);

    context.addLog(msg.delta?.['reason'] || 'Lock rechazado');
    this.dragSession.reset();

    return { shouldResetDrag: true };
  }

  private handleCreateMessage(
    msg: SocketOperationMessage,
    context: DiagramEditorMessageHandlerContext,
  ): DiagramEditorMessageHandlerResult {
    const cell = msg.delta?.['cell'];
    this.snapshotStore.addCreatedCell(cell);

    if (cell) {
      context.canvasManager?.addCell(cell);
    }

    return {};
  }

  private handleMoveMessage(
    msg: SocketOperationMessage,
    context: DiagramEditorMessageHandlerContext,
  ): DiagramEditorMessageHandlerResult {
    if (msg.userId === context.currentUserId) {
      if (
        msg.dragId &&
        this.dragSession.currentActiveDragId &&
        msg.dragId !== this.dragSession.currentActiveDragId
      ) {
        return {};
      }
    }

    const isOwnLiveEcho = msg.userId === context.currentUserId && msg.opType === 'MOVE_LIVE';

    if (!isOwnLiveEcho) {
      context.canvasManager?.applyMove(msg.cellId, msg.delta['x'], msg.delta['y']);
    }

    this.snapshotStore.applyMoveMessage(msg);
    return {};
  }

  private handleUpdateMessage(
    msg: SocketOperationMessage,
    context: DiagramEditorMessageHandlerContext,
  ): DiagramEditorMessageHandlerResult {
    this.snapshotStore.applyMessageUpdate(msg);
    context.canvasManager?.applyUpdate(msg.cellId, msg.delta);
    return {};
  }

  private handleDeleteMessage(
    msg: SocketOperationMessage,
    context: DiagramEditorMessageHandlerContext,
  ): DiagramEditorMessageHandlerResult {
    this.snapshotStore.deleteCellCascade(msg.cellId);
    context.canvasManager?.applyDelete(msg.cellId);

    this.lockState.clearAllLocksForCell(msg.cellId);
    this.lockState.clearPreDragPosition(msg.cellId);

    let shouldResetDrag = false;
    if (this.dragSession.currentDraggingCellId === msg.cellId) {
      this.dragSession.reset();
      shouldResetDrag = true;
    }

    return {
      shouldResetDrag,
      shouldClearSelectedCell: context.selectedCellId === msg.cellId,
    };
  }
}