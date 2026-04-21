import { Injectable, inject, signal } from '@angular/core';
import { Subscription } from 'rxjs';

import { AuthService } from '../../auth/services/auth.service';
import {
  DiagramCell,
  JoinSessionResponse,
  SocketOperationMessage,
} from '../interfaces/diagram.models';
import { EditorCanvasManager } from '../utils/editor-canvas.manager';
import {
  deleteSnapshotCellCascade,
  findSnapshotCell,
  updateSnapshotCellFromMessage,
  updateSnapshotCellPosition,
  upsertCreatedCell,
} from '../utils/editor-snapshot.utils';
import { DiagramSyncService } from './diagram-sync.service';
import { DiagramService } from './diagram.service';

type DragPhase = 'idle' | 'locking' | 'dragging' | 'committing';

@Injectable()
export class DiagramEditorCollaborationService {
  private readonly diagramService = inject(DiagramService);
  private readonly syncService = inject(DiagramSyncService);
  private readonly authService = inject(AuthService);

  private subscriptions: Subscription[] = [];
  private canvasManager?: EditorCanvasManager;

  private viewReady = false;
  private sessionLoaded = false;

  private localLockedCellIds = new Set<string>();
  private remoteLockedCellIds = new Set<string>();
  private preDragPositions = new Map<string, { x: number; y: number }>();

  private draggingCellId: string | null = null;
  private activeDragId: string | null = null;
  private dragPhase: DragPhase = 'idle';

  private pendingLockCellId: string | null = null;
  private pendingLockDragId: string | null = null;

  private pendingReleaseWhileLocking = false;
  private pendingReleasePosition: { x: number; y: number } | null = null;

  private lastLiveSentAt = 0;
  private readonly liveThrottleMs = 50;

  private readonly handleWindowPointerUp = () => {
    this.addLog(
      `POINTER_UP_WINDOW => dragging=${this.draggingCellId ?? '-'} | phase=${this.dragPhase}`,
    );

    if (this.dragPhase === 'locking' && this.draggingCellId) {
      const position = this.canvasManager?.getElementPosition(this.draggingCellId) ?? null;
      this.pendingReleaseWhileLocking = true;
      this.pendingReleasePosition = position;

      this.addLog(
        `WINDOW_RELEASE_BUFFERED_WHILE_LOCKING => ${this.draggingCellId} | x=${position?.x ?? '-'} | y=${position?.y ?? '-'}`,
      );
      return;
    }

    this.finishActiveDrag();
  };

  private readonly handleWindowPointerCancel = () => {
    this.addLog(
      `POINTER_CANCEL_WINDOW => dragging=${this.draggingCellId ?? '-'} | phase=${this.dragPhase}`,
    );

    if (this.dragPhase === 'locking' && this.draggingCellId) {
      const position = this.canvasManager?.getElementPosition(this.draggingCellId) ?? null;
      this.pendingReleaseWhileLocking = true;
      this.pendingReleasePosition = position;

      this.addLog(
        `WINDOW_CANCEL_BUFFERED_WHILE_LOCKING => ${this.draggingCellId} | x=${position?.x ?? '-'} | y=${position?.y ?? '-'}`,
      );
      return;
    }

    this.finishActiveDrag();
  };

  private readonly handleWindowBlur = () => {
    this.addLog(`WINDOW_BLUR => dragging=${this.draggingCellId ?? '-'} | phase=${this.dragPhase}`);

    if (this.dragPhase === 'locking' && this.draggingCellId) {
      const position = this.canvasManager?.getElementPosition(this.draggingCellId) ?? null;
      this.pendingReleaseWhileLocking = true;
      this.pendingReleasePosition = position;

      this.addLog(
        `WINDOW_BLUR_BUFFERED_WHILE_LOCKING => ${this.draggingCellId} | x=${position?.x ?? '-'} | y=${position?.y ?? '-'}`,
      );
      return;
    }

    this.finishActiveDrag();
  };

  public diagramId = signal('');
  public sessionToken = signal('');
  public isConnected = signal(false);
  public snapshotCells = signal<DiagramCell[]>([]);
  public logs = signal<string[]>([]);

  public selectedCellId = signal('');
  public selectedTargetId = signal('');
  public labelText = signal('Actividad Editada');

  public currentUserId = () => this.authService.currentUser()?.id || '';

  initDiagram(diagramId: string): void {
    this.diagramId.set(diagramId);

    if (!diagramId) {
      this.addLog('No llegó diagramId por ruta');
      return;
    }

    this.joinSession(diagramId);
  }

  attachCanvas(host: HTMLDivElement): void {
    this.canvasManager = new EditorCanvasManager(host, {
      onCellSelected: (cellId: string, label: string) => {
        this.selectedCellId.set(cellId);
        if (label.trim()) {
          this.labelText.set(label);
        }
        this.addLog(`Seleccionada: ${cellId}`);
      },

      onBlankDoubleClick: (x: number, y: number) => {
        this.createNodeAt(x, y);
      },

      onElementPointerDown: (cellId: string, position: { x: number; y: number }) => {
        this.addLog(`POINTER_DOWN => ${cellId} | phase=${this.dragPhase}`);

        if (
          this.dragPhase !== 'idle' ||
          this.draggingCellId !== null ||
          this.pendingLockCellId !== null ||
          this.activeDragId !== null
        ) {
          this.addLog(
            `DRAG_BLOCKED_PENDING_PREVIOUS => requested=${cellId} current=${this.draggingCellId ?? '-'} phase=${this.dragPhase}`,
          );
          return;
        }

        if (this.remoteLockedCellIds.has(cellId)) {
          this.addLog(`Celda bloqueada por otro usuario: ${cellId}`);
          return;
        }

        const dragId = this.generateDragId();

        this.selectedCellId.set(cellId);
        this.preDragPositions.set(cellId, position);

        this.draggingCellId = cellId;
        this.activeDragId = dragId;
        this.pendingLockCellId = cellId;
        this.pendingLockDragId = dragId;
        this.dragPhase = 'locking';

        this.pendingReleaseWhileLocking = false;
        this.pendingReleasePosition = null;

        this.addLog(`LOCK_REQUEST => ${cellId} | drag=${dragId}`);
        this.syncService.LOCK_CELL(cellId, this.currentUserId(), dragId);
      },

      onElementPositionChanged: (cellId: string, x: number, y: number) => {
        if (this.draggingCellId !== cellId) return;
        if (this.dragPhase !== 'dragging') return;
        if (!this.localLockedCellIds.has(cellId)) return;
        if (!this.activeDragId) return;

        const now = Date.now();

        this.snapshotCells.update((cells) => updateSnapshotCellPosition(cells, cellId, x, y));

        if (now - this.lastLiveSentAt < this.liveThrottleMs) {
          return;
        }

        this.lastLiveSentAt = now;
        this.syncService.MOVE_LIVE(cellId, this.currentUserId(), x, y, this.activeDragId);
      },

      onElementPointerUp: (cellId: string, x: number, y: number) => {
        this.addLog(`POINTER_UP_ELEMENT => ${cellId} | phase=${this.dragPhase}`);

        if (this.draggingCellId !== cellId) return;

        if (this.dragPhase === 'locking') {
          this.pendingReleaseWhileLocking = true;
          this.pendingReleasePosition = { x, y };
          this.addLog(`RELEASE_BUFFERED_WHILE_LOCKING => ${cellId} | x=${x} | y=${y}`);
          return;
        }

        this.finishActiveDrag(x, y);
      },

      isCellRemotelyLocked: (cellId: string) => {
        return this.remoteLockedCellIds.has(cellId);
      },

      getActiveDraggingCellId: () => {
        return this.draggingCellId;
      },

      isDragTransitionLocked: () => {
        return (
          this.dragPhase !== 'idle' ||
          this.draggingCellId !== null ||
          this.pendingLockCellId !== null ||
          this.activeDragId !== null
        );
      },
    });

    this.canvasManager.init();
    this.viewReady = true;
    this.registerGlobalDragSafety();

    if (this.sessionLoaded) {
      this.renderSnapshot();
    }
  }

  destroy(): void {
    this.unregisterGlobalDragSafety();
    this.syncService.DISCONNECT();
    this.subscriptions.forEach((s) => s.unsubscribe());
    this.canvasManager?.destroy();
  }

  createNode(): void {
    this.createNodeAt(140, 80);
  }

  lockCell(): void {
    if (!this.selectedCellId()) return;
    if (this.draggingCellId || this.dragPhase !== 'idle') return;

    const dragId = this.generateDragId();

    this.draggingCellId = this.selectedCellId();
    this.activeDragId = dragId;
    this.pendingLockCellId = this.selectedCellId();
    this.pendingLockDragId = dragId;
    this.dragPhase = 'locking';

    this.pendingReleaseWhileLocking = false;
    this.pendingReleasePosition = null;

    this.syncService.LOCK_CELL(this.selectedCellId(), this.currentUserId(), dragId);
  }

  unlockCell(): void {
    if (!this.selectedCellId() || !this.activeDragId) return;
    this.syncService.UNLOCK_CELL(this.selectedCellId(), this.currentUserId(), this.activeDragId);
  }

  updateNode(): void {
    if (!this.selectedCellId()) return;
    this.syncService.UPDATE_NODE(this.selectedCellId(), this.currentUserId(), this.labelText());
  }

  createLink(): void {
    if (!this.selectedCellId() || !this.selectedTargetId()) return;

    const linkId = `link-${Date.now()}`;
    this.syncService.CREATE_LINK(
      linkId,
      this.selectedCellId(),
      this.selectedTargetId(),
      this.currentUserId(),
    );
  }

  deleteCell(): void {
    if (!this.selectedCellId()) return;
    this.syncService.DELETE_CELL(this.selectedCellId(), this.currentUserId());
  }

  sendPing(): void {
    this.syncService.SEND_PING(this.currentUserId(), 320, 220);
  }

  private joinSession(diagramId: string): void {
    this.diagramService.JOIN_SESSION(diagramId).subscribe({
      next: (response: JoinSessionResponse) => {
        this.sessionToken.set(response.sessionToken);

        try {
          const parsed = response.snapshot ? JSON.parse(response.snapshot) : [];
          this.snapshotCells.set(parsed);
        } catch {
          this.snapshotCells.set([]);
        }

        this.sessionLoaded = true;
        this.addLog(`Sesión iniciada: ${response.sessionToken}`);

        if (this.viewReady) {
          this.renderSnapshot();
        }

        this.connectSocket(response.sessionToken);
      },
      error: (err) => {
        console.error(err);
        this.addLog('Error al entrar a la sesión');
      },
    });
  }

  private connectSocket(sessionToken: string): void {
    const sub1 = this.syncService.onMessage$.subscribe((msg) => {
      this.addLog(`MSG => ${msg.opType} | ${msg.cellId} | drag=${msg.dragId ?? '-'}`);
      this.applyIncomingMessage(msg);
    });

    const sub2 = this.syncService.onConnectionState$.subscribe((state) => {
      this.isConnected.set(state === 'CONNECTED');
      this.addLog(`Socket: ${state}`);
    });

    this.subscriptions.push(sub1, sub2);
    this.syncService.CONNECT(sessionToken);
  }

  private renderSnapshot(): void {
    this.canvasManager?.clearAndRender(this.snapshotCells());
  }

  private applyIncomingMessage(msg: SocketOperationMessage): void {
    switch (msg.opType) {
      case 'LOCK_CELL':
        this.handleLockMessage(msg);
        return;

      case 'UNLOCK_CELL':
        this.handleUnlockMessage(msg);
        return;

      case 'LOCK_REJECTED':
        this.handleLockRejected(msg);
        return;

      case 'CREATE_NODE':
      case 'CREATE_LINK':
        this.handleCreateMessage(msg);
        return;

      case 'MOVE_LIVE':
      case 'MOVE_COMMIT':
        this.handleMoveMessage(msg);
        return;

      case 'UPDATE_NODE':
      case 'UPDATE_LINK':
        this.handleUpdateMessage(msg);
        return;

      case 'DELETE_CELL':
      case 'DELETE_LINK':
        this.handleDeleteMessage(msg);
        return;

      default:
        return;
    }
  }

  private handleLockMessage(msg: SocketOperationMessage): void {
    const cellId = msg.cellId;
    const dragId = msg.dragId ?? null;

    if (msg.userId === this.currentUserId()) {
      if (this.pendingLockCellId !== cellId || this.pendingLockDragId !== dragId) {
        return;
      }

      this.localLockedCellIds.add(cellId);
      this.remoteLockedCellIds.delete(cellId);

      this.draggingCellId = cellId;
      this.activeDragId = dragId;
      this.dragPhase = 'dragging';

      this.pendingLockCellId = null;
      this.pendingLockDragId = null;

      this.canvasManager?.paintLockState(cellId, 'local');

      if (this.pendingReleaseWhileLocking) {
        const releasePos = this.pendingReleasePosition;
        this.pendingReleaseWhileLocking = false;
        this.pendingReleasePosition = null;

        this.addLog(`LOCK_CONFIRMED_WITH_BUFFERED_RELEASE => ${cellId} | drag=${dragId}`);

        this.finishActiveDrag(releasePos?.x, releasePos?.y);
        return;
      }

      return;
    }

    this.remoteLockedCellIds.add(cellId);
    this.localLockedCellIds.delete(cellId);
    this.canvasManager?.paintLockState(cellId, 'remote');
  }

  private handleUnlockMessage(msg: SocketOperationMessage): void {
    const cellId = msg.cellId;
    const dragId = msg.dragId ?? null;

    this.localLockedCellIds.delete(cellId);
    this.remoteLockedCellIds.delete(cellId);

    const snapshotCell = findSnapshotCell(this.snapshotCells(), cellId);
    this.canvasManager?.clearLockState(snapshotCell);

    this.preDragPositions.delete(cellId);

    if (msg.userId === this.currentUserId()) {
      if (this.draggingCellId === cellId && this.activeDragId === dragId) {
        this.draggingCellId = null;
        this.activeDragId = null;
        this.dragPhase = 'idle';
        this.pendingReleaseWhileLocking = false;
        this.pendingReleasePosition = null;
      }

      if (this.pendingLockCellId === cellId && this.pendingLockDragId === dragId) {
        this.pendingLockCellId = null;
        this.pendingLockDragId = null;
        this.dragPhase = 'idle';
        this.pendingReleaseWhileLocking = false;
        this.pendingReleasePosition = null;
      }
    }
  }

  private handleLockRejected(msg: SocketOperationMessage): void {
    if (msg.userId !== this.currentUserId()) return;

    if (this.pendingLockCellId !== msg.cellId || this.pendingLockDragId !== (msg.dragId ?? null)) {
      return;
    }

    this.localLockedCellIds.delete(msg.cellId);

    const previousPosition = this.preDragPositions.get(msg.cellId);
    if (previousPosition) {
      this.canvasManager?.restoreElementPosition(
        msg.cellId,
        previousPosition.x,
        previousPosition.y,
      );

      this.snapshotCells.update((cells) =>
        updateSnapshotCellPosition(cells, msg.cellId, previousPosition.x, previousPosition.y),
      );
    }

    const snapshotCell = findSnapshotCell(this.snapshotCells(), msg.cellId);
    this.canvasManager?.clearLockState(snapshotCell);

    this.addLog(msg.delta?.['reason'] || 'Lock rechazado');

    this.pendingLockCellId = null;
    this.pendingLockDragId = null;
    this.draggingCellId = null;
    this.activeDragId = null;
    this.dragPhase = 'idle';
    this.pendingReleaseWhileLocking = false;
    this.pendingReleasePosition = null;
  }

  private handleCreateMessage(msg: SocketOperationMessage): void {
    const cell = msg.delta?.['cell'] as DiagramCell | undefined;

    this.snapshotCells.update((cells) => upsertCreatedCell(cells, cell));

    if (cell) {
      this.canvasManager?.addCell(cell);
    }
  }

  private handleMoveMessage(msg: SocketOperationMessage): void {
    if (msg.userId === this.currentUserId()) {
      if (msg.dragId && this.activeDragId && msg.dragId !== this.activeDragId) {
        return;
      }
    }

    const isOwnLiveEcho = msg.userId === this.currentUserId() && msg.opType === 'MOVE_LIVE';

    if (!isOwnLiveEcho) {
      this.canvasManager?.applyMove(msg.cellId, msg.delta['x'], msg.delta['y']);
    }

    this.snapshotCells.update((cells) =>
      updateSnapshotCellPosition(cells, msg.cellId, msg.delta['x'], msg.delta['y']),
    );
  }

  private handleUpdateMessage(msg: SocketOperationMessage): void {
    this.snapshotCells.update((cells) => updateSnapshotCellFromMessage(cells, msg));
    this.canvasManager?.applyUpdate(msg.cellId, msg.delta);
  }

  private handleDeleteMessage(msg: SocketOperationMessage): void {
    this.snapshotCells.update((cells) => deleteSnapshotCellCascade(cells, msg.cellId));
    this.canvasManager?.applyDelete(msg.cellId);

    this.localLockedCellIds.delete(msg.cellId);
    this.remoteLockedCellIds.delete(msg.cellId);
    this.preDragPositions.delete(msg.cellId);

    if (this.selectedCellId() === msg.cellId) {
      this.selectedCellId.set('');
    }

    if (this.draggingCellId === msg.cellId) {
      this.draggingCellId = null;
      this.activeDragId = null;
      this.dragPhase = 'idle';
    }

    if (this.pendingLockCellId === msg.cellId) {
      this.pendingLockCellId = null;
      this.pendingLockDragId = null;
      this.dragPhase = 'idle';
    }

    this.pendingReleaseWhileLocking = false;
    this.pendingReleasePosition = null;
  }

  private createNodeAt(x: number, y: number): void {
    const cellId = `node-${Date.now()}`;
    this.selectedCellId.set(cellId);
    this.syncService.CREATE_NODE(cellId, this.currentUserId(), x, y);
  }

  private finishActiveDrag(forceX?: number, forceY?: number): void {
    this.addLog(
      `FINISH_DRAG_CALLED => cell=${this.draggingCellId ?? '-'} | drag=${this.activeDragId ?? '-'} | phase=${this.dragPhase}`,
    );

    const cellId = this.draggingCellId;
    const dragId = this.activeDragId;

    if (!cellId || !dragId) return;
    if (this.dragPhase !== 'dragging') return;

    if (!this.localLockedCellIds.has(cellId)) {
      this.draggingCellId = null;
      this.activeDragId = null;
      this.dragPhase = 'idle';
      this.pendingReleaseWhileLocking = false;
      this.pendingReleasePosition = null;
      return;
    }

    let x = forceX;
    let y = forceY;

    if (x === undefined || y === undefined) {
      const position = this.canvasManager?.getElementPosition(cellId);
      if (!position) {
        this.draggingCellId = null;
        this.activeDragId = null;
        this.dragPhase = 'idle';
        this.pendingReleaseWhileLocking = false;
        this.pendingReleasePosition = null;
        return;
      }

      x = position.x;
      y = position.y;
    }

    this.dragPhase = 'committing';

    this.addLog(`MOVE_COMMIT_SEND => ${cellId} | drag=${dragId} | x=${x} | y=${y}`);

    this.syncService.MOVE_COMMIT(cellId, this.currentUserId(), x, y, dragId);
  }

  private registerGlobalDragSafety(): void {
    if (typeof window === 'undefined') return;

    window.addEventListener('pointerup', this.handleWindowPointerUp);
    window.addEventListener('pointercancel', this.handleWindowPointerCancel);
    window.addEventListener('blur', this.handleWindowBlur);
  }

  private unregisterGlobalDragSafety(): void {
    if (typeof window === 'undefined') return;

    window.removeEventListener('pointerup', this.handleWindowPointerUp);
    window.removeEventListener('pointercancel', this.handleWindowPointerCancel);
    window.removeEventListener('blur', this.handleWindowBlur);
  }

  private generateDragId(): string {
    return `drag-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }

  private addLog(text: string): void {
    this.logs.update((current) => [`${new Date().toLocaleTimeString()} - ${text}`, ...current]);
  }
}
