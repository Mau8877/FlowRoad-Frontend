import { Injectable, inject, signal } from '@angular/core';
import { Subscription } from 'rxjs';

import { AuthService } from '../../auth/services/auth.service';
import {
  JoinSessionResponse,
  SocketOperationMessage,
} from '../interfaces/diagram.models';
import { EditorCanvasManager } from '../utils/editor-canvas.manager';
import { DiagramEditorDragSessionService } from './diagram-editor-drag-session.service';
import { DiagramEditorLaneService } from './diagram-editor-lane.service';
import { DiagramEditorLockStateService } from './diagram-editor-lock-state.service';
import {
  DiagramEditorMessageHandlerResult,
  DiagramEditorMessageHandlerService,
} from './diagram-editor-message-handler.service';
import { DiagramEditorSnapshotStoreService } from './diagram-editor-snapshot-store.service';
import { DiagramSyncService } from './diagram-sync.service';
import { DiagramService } from './diagram.service';

@Injectable()
export class DiagramEditorCollaborationService {
  private readonly diagramService = inject(DiagramService);
  private readonly syncService = inject(DiagramSyncService);
  private readonly authService = inject(AuthService);

  private readonly dragSession = inject(DiagramEditorDragSessionService);
  private readonly laneService = inject(DiagramEditorLaneService);
  private readonly lockState = inject(DiagramEditorLockStateService);
  private readonly snapshotStore = inject(DiagramEditorSnapshotStoreService);
  private readonly messageHandler = inject(DiagramEditorMessageHandlerService);

  private subscriptions: Subscription[] = [];
  private canvasManager?: EditorCanvasManager;

  private viewReady = false;
  private sessionLoaded = false;

  private lastLiveSentAt = 0;
  private readonly liveThrottleMs = 50;

  public diagramId = signal('');
  public sessionToken = signal('');
  public isConnected = signal(false);
  public snapshotCells = this.snapshotStore.cells;
  public logs = signal<string[]>([]);

  public selectedCellId = signal('');
  public selectedTargetId = signal('');
  public labelText = signal('Actividad Editada');

  public currentUserId = () => this.authService.currentUser()?.id || '';

  private readonly handleWindowPointerUp = () => {
    this.handleGlobalRelease();
  };

  private readonly handleWindowPointerCancel = () => {
    this.handleGlobalRelease();
  };

  private readonly handleWindowBlur = () => {
    this.handleGlobalRelease();
  };

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
      },

      onBlankDoubleClick: (x: number, y: number) => {
        this.createNodeAt(x, y);
      },

      onElementPointerDown: (cellId: string, position: { x: number; y: number }) => {
        this.startDragLock(cellId, position);
      },

      onElementPositionChanged: (cellId: string, x: number, y: number) => {
        this.handleElementPositionChanged(cellId, x, y);
      },

      onElementPointerUp: (cellId: string, x: number, y: number) => {
        this.handleElementPointerUp(cellId, x, y);
      },

      isCellRemotelyLocked: (cellId: string) => {
        return this.lockState.isRemotelyLocked(cellId);
      },

      getActiveDraggingCellId: () => {
        return this.dragSession.currentDraggingCellId;
      },

      isDragTransitionLocked: () => {
        return this.dragSession.isTransitionLocked();
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

    this.dragSession.reset();
    this.lockState.reset();
    this.snapshotStore.clear();
  }

  createNode(): void {
    const initialPosition = this.laneService.getDefaultCreatePosition();
    if (!initialPosition) {
      this.addLog('No hay lanes configuradas para crear nodos.');
      return;
    }

    this.createNodeAt(initialPosition.x, initialPosition.y);
  }

  lockCell(): void {
    const cellId = this.selectedCellId();
    if (!cellId) return;
    if (this.dragSession.shouldBlockNewDrag()) return;

    const dragId = this.generateDragId();
    this.dragSession.beginLock(cellId, dragId);
    this.lastLiveSentAt = 0;

    this.syncService.LOCK_CELL(cellId, this.currentUserId(), dragId);
  }

  unlockCell(): void {
    const cellId = this.selectedCellId();
    const dragId = this.dragSession.currentActiveDragId;
    if (!cellId || !dragId) return;

    this.syncService.UNLOCK_CELL(cellId, this.currentUserId(), dragId);
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

  private startDragLock(cellId: string, position: { x: number; y: number }): void {
    if (this.dragSession.shouldBlockNewDrag()) {
      this.addLog(
        `DRAG_BLOCKED_PENDING_PREVIOUS => requested=${cellId} current=${this.dragSession.currentDraggingCellId ?? '-'} phase=${this.dragSession.currentPhase}`,
      );
      return;
    }

    if (this.lockState.isRemotelyLocked(cellId)) {
      return;
    }

    const dragId = this.generateDragId();

    this.selectedCellId.set(cellId);
    this.lockState.rememberPreDragPosition(cellId, position);
    this.dragSession.beginLock(cellId, dragId);
    this.lastLiveSentAt = 0;

    this.addLog(`LOCK_REQUEST => ${cellId} | drag=${dragId}`);
    this.syncService.LOCK_CELL(cellId, this.currentUserId(), dragId);
  }

  private handleElementPositionChanged(cellId: string, x: number, y: number): void {
    if (!this.dragSession.isDraggingCell(cellId)) return;
    if (this.dragSession.currentPhase !== 'dragging') return;
    if (!this.lockState.isLocallyLocked(cellId)) return;
    if (!this.dragSession.currentActiveDragId) return;

    const now = Date.now();

    this.snapshotStore.updateCellPosition(cellId, x, y);

    if (now - this.lastLiveSentAt < this.liveThrottleMs) {
      return;
    }

    this.lastLiveSentAt = now;
    this.syncService.MOVE_LIVE(
      cellId,
      this.currentUserId(),
      x,
      y,
      this.dragSession.currentActiveDragId,
    );
  }

  private handleElementPointerUp(cellId: string, x: number, y: number): void {
    if (!this.dragSession.isDraggingCell(cellId)) return;

    if (this.dragSession.isLockingForCell(cellId)) {
      this.dragSession.bufferRelease({ x, y });
      return;
    }

    this.finishActiveDrag(x, y);
  }

  private handleGlobalRelease(): void {
    const draggingCellId = this.dragSession.currentDraggingCellId;
    if (!draggingCellId) return;

    if (this.dragSession.isLockingForCell(draggingCellId)) {
      const position = this.canvasManager?.getElementPosition(draggingCellId) ?? null;
      this.dragSession.bufferRelease(position);
      return;
    }

    this.finishActiveDrag();
  }

  private joinSession(diagramId: string): void {
    this.diagramService.JOIN_SESSION(diagramId).subscribe({
      next: (response: JoinSessionResponse) => {
        this.sessionToken.set(response.sessionToken);

        try {
          const parsed = response.snapshot ? JSON.parse(response.snapshot) : [];
          this.snapshotStore.setSnapshot(parsed);
        } catch {
          this.snapshotStore.setSnapshot([]);
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
    const result = this.messageHandler.handleIncomingMessage(msg, {
      currentUserId: this.currentUserId(),
      selectedCellId: this.selectedCellId(),
      canvasManager: this.canvasManager,
      addLog: (text) => this.addLog(text),
    });

    this.applyMessageHandlerResult(result);
  }

  private applyMessageHandlerResult(result: DiagramEditorMessageHandlerResult): void {
    if (result.shouldResetDrag) {
      this.lastLiveSentAt = 0;
    }

    if (result.shouldClearSelectedCell) {
      this.selectedCellId.set('');
    }

    if (result.finishDragPosition !== undefined) {
      this.finishActiveDrag(result.finishDragPosition?.x, result.finishDragPosition?.y);
    }
  }

  private createNodeAt(x: number, y: number): void {
    const lane = this.laneService.resolveLaneForX(x);
    if (!lane) {
      this.addLog('No se pudo crear nodo: no hay una lane válida en esa posición.');
      return;
    }

    const normalizedPosition = this.laneService.normalizeNodePositionToLane(x, y, lane);
    const cellId = `node-${Date.now()}`;

    this.selectedCellId.set(cellId);

    this.syncService.CREATE_NODE(
      cellId,
      this.currentUserId(),
      normalizedPosition.x,
      normalizedPosition.y,
      lane.id,
    );
  }

  private finishActiveDrag(forceX?: number, forceY?: number): void {
    const cellId = this.dragSession.currentDraggingCellId;
    const dragId = this.dragSession.currentActiveDragId;

    if (!cellId || !dragId) return;
    if (!this.dragSession.canCommit(cellId, dragId)) return;

    if (!this.lockState.isLocallyLocked(cellId)) {
      this.dragSession.reset();
      this.lastLiveSentAt = 0;
      return;
    }

    let x = forceX;
    let y = forceY;

    if (x === undefined || y === undefined) {
      const position = this.canvasManager?.getElementPosition(cellId);
      if (!position) {
        this.dragSession.reset();
        this.lastLiveSentAt = 0;
        return;
      }

      x = position.x;
      y = position.y;
    }

    const resolvedLane = this.laneService.resolveLaneForX(x);
    if (!resolvedLane) {
      this.addLog(`MOVE_COMMIT_BLOCKED_NO_LANE => ${cellId}`);
      this.dragSession.reset();
      this.lastLiveSentAt = 0;
      return;
    }

    const normalizedPosition = this.laneService.normalizeNodePositionToLane(x, y, resolvedLane);

    this.snapshotStore.update((cells) =>
      cells.map((cell) => {
        if (cell.id !== cellId || cell.type === 'standard.Link') return cell;

        return {
          ...cell,
          position: {
            x: normalizedPosition.x,
            y: normalizedPosition.y,
          },
          customData: {
            ...(cell.customData ?? {}),
            laneId: resolvedLane.id,
          },
        };
      }),
    );

    this.canvasManager?.applyMove(cellId, normalizedPosition.x, normalizedPosition.y);

    this.dragSession.markCommitting();

    this.addLog(
      `MOVE_COMMIT_SEND => ${cellId} | drag=${dragId} | x=${normalizedPosition.x} | y=${normalizedPosition.y} | lane=${resolvedLane.id}`,
    );

    this.syncService.MOVE_COMMIT(
      cellId,
      this.currentUserId(),
      normalizedPosition.x,
      normalizedPosition.y,
      dragId,
      resolvedLane.id,
    );
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