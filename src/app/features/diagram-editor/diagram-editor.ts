import { CommonModule } from '@angular/common';
import {
  AfterViewInit,
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  ViewChild,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { Subscription } from 'rxjs';

import { AuthService } from '../auth/services/auth.service';
import {
  DiagramCell,
  JoinSessionResponse,
  SocketOperationMessage,
} from './interfaces/diagram.models';
import { DiagramSyncService } from './services/diagram-sync.service';
import { DiagramService } from './services/diagram.service';
import { EditorCanvasManager } from './utils/editor-canvas.manager';
import {
  deleteSnapshotCellCascade,
  findSnapshotCell,
  updateSnapshotCellFromMessage,
  updateSnapshotCellPosition,
  upsertCreatedCell,
} from './utils/editor-snapshot.utils';

@Component({
  selector: 'app-diagram-editor',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './diagram-editor.html',
  styleUrl: './diagram-editor.css',
})
export class DiagramEditor implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('paperHost', { static: true }) paperHost!: ElementRef<HTMLDivElement>;

  private route = inject(ActivatedRoute);
  private diagramService = inject(DiagramService);
  private syncService = inject(DiagramSyncService);
  private authService = inject(AuthService);

  private subscriptions: Subscription[] = [];
  private canvasManager?: EditorCanvasManager;

  private viewReady = false;
  private sessionLoaded = false;

  private localLockedCellIds = new Set<string>();
  private remoteLockedCellIds = new Set<string>();
  private preDragPositions = new Map<string, { x: number; y: number }>();

  private draggingCellId: string | null = null;
  private lastLiveSentAt = 0;
  private readonly liveThrottleMs = 40;

  public diagramId = signal('');
  public sessionToken = signal('');
  public isConnected = signal(false);
  public snapshotCells = signal<DiagramCell[]>([]);
  public logs = signal<string[]>([]);

  public selectedCellId = signal('');
  public selectedTargetId = signal('');
  public labelText = signal('Actividad Editada');

  public currentUserId = computed(() => this.authService.currentUser()?.id || '');

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id') || '';
    this.diagramId.set(id);

    if (!id) {
      this.addLog('No llegó diagramId por ruta');
      return;
    }

    this.joinSession(id);
  }

  ngAfterViewInit(): void {
    this.initializeCanvas();
    this.viewReady = true;

    if (this.sessionLoaded) {
      this.renderSnapshot();
    }
  }

  ngOnDestroy(): void {
    this.syncService.DISCONNECT();
    this.subscriptions.forEach((s) => s.unsubscribe());
    this.canvasManager?.destroy();
  }

  private initializeCanvas(): void {
    this.canvasManager = new EditorCanvasManager(this.paperHost.nativeElement, {
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
        this.selectedCellId.set(cellId);
        this.preDragPositions.set(cellId, position);

        if (this.remoteLockedCellIds.has(cellId)) {
          this.addLog(`Celda bloqueada por otro usuario: ${cellId}`);
          this.draggingCellId = null;
          return;
        }

        this.draggingCellId = cellId;

        if (!this.localLockedCellIds.has(cellId)) {
          this.localLockedCellIds.add(cellId);
          this.canvasManager?.paintLockState(cellId, 'local');
          this.syncService.LOCK_CELL(cellId, this.currentUserId());
        }
      },

      onElementPositionChanged: (cellId: string, x: number, y: number) => {
        if (!this.localLockedCellIds.has(cellId)) return;
        if (this.draggingCellId !== cellId) return;

        const now = Date.now();

        this.snapshotCells.update((cells) => updateSnapshotCellPosition(cells, cellId, x, y));

        if (now - this.lastLiveSentAt < this.liveThrottleMs) {
          return;
        }

        this.lastLiveSentAt = now;
        this.syncService.MOVE_LIVE(cellId, this.currentUserId(), x, y);
      },

      onElementPointerUp: (cellId: string, x: number, y: number) => {
        if (!this.localLockedCellIds.has(cellId)) {
          this.draggingCellId = null;
          return;
        }

        this.syncService.MOVE_COMMIT(cellId, this.currentUserId(), x, y);
        this.draggingCellId = null;
      },

      isCellRemotelyLocked: (cellId: string) => {
        return this.remoteLockedCellIds.has(cellId);
      },
    });

    this.canvasManager.init();
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
      this.addLog(`MSG => ${msg.opType} | ${msg.cellId}`);
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

    if (msg.userId === this.currentUserId()) {
      this.localLockedCellIds.add(cellId);
      this.remoteLockedCellIds.delete(cellId);
      this.canvasManager?.paintLockState(cellId, 'local');
      return;
    }

    this.remoteLockedCellIds.add(cellId);
    this.localLockedCellIds.delete(cellId);
    this.canvasManager?.paintLockState(cellId, 'remote');
  }

  private handleUnlockMessage(msg: SocketOperationMessage): void {
    const cellId = msg.cellId;

    this.localLockedCellIds.delete(cellId);
    this.remoteLockedCellIds.delete(cellId);

    const snapshotCell = findSnapshotCell(this.snapshotCells(), cellId);
    this.canvasManager?.clearLockState(snapshotCell);

    this.preDragPositions.delete(cellId);
  }

  private handleLockRejected(msg: SocketOperationMessage): void {
    if (msg.userId !== this.currentUserId()) return;

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
    this.preDragPositions.delete(msg.cellId);
    this.draggingCellId = null;
  }

  private handleCreateMessage(msg: SocketOperationMessage): void {
    const cell = msg.delta?.['cell'] as DiagramCell | undefined;

    this.snapshotCells.update((cells) => upsertCreatedCell(cells, cell));

    if (cell) {
      this.canvasManager?.addCell(cell);
    }
  }

  private handleMoveMessage(msg: SocketOperationMessage): void {
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
  }

  private createNodeAt(x: number, y: number): void {
    const cellId = `node-${Date.now()}`;
    this.selectedCellId.set(cellId);
    this.syncService.CREATE_NODE(cellId, this.currentUserId(), x, y);
  }

  createNode(): void {
    this.createNodeAt(140, 80);
  }

  lockCell(): void {
    if (!this.selectedCellId()) return;

    this.localLockedCellIds.add(this.selectedCellId());
    this.canvasManager?.paintLockState(this.selectedCellId(), 'local');
    this.syncService.LOCK_CELL(this.selectedCellId(), this.currentUserId());
  }

  unlockCell(): void {
    if (!this.selectedCellId()) return;
    this.syncService.UNLOCK_CELL(this.selectedCellId(), this.currentUserId());
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

  private addLog(text: string): void {
    this.logs.update((current) => [`${new Date().toLocaleTimeString()} - ${text}`, ...current]);
  }
}
