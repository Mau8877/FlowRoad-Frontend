import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
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

@Component({
  selector: 'app-diagram-editor',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './diagram-editor.html',
})
export class DiagramEditor implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private diagramService = inject(DiagramService);
  private syncService = inject(DiagramSyncService);
  private authService = inject(AuthService);

  private subscriptions: Subscription[] = [];

  public diagramId = signal('');
  public sessionToken = signal('');
  public isConnected = signal(false);
  public snapshotCells = signal<DiagramCell[]>([]);
  public logs = signal<string[]>([]);

  public selectedCellId = signal('node-1');
  public selectedTargetId = signal('node-2');
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

  ngOnDestroy(): void {
    this.syncService.DISCONNECT();
    this.subscriptions.forEach((s) => s.unsubscribe());
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

        this.addLog(`Sesión iniciada: ${response.sessionToken}`);
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

  private applyIncomingMessage(msg: SocketOperationMessage): void {
    if (msg.opType === 'CREATE_NODE' || msg.opType === 'CREATE_LINK') {
      const cell = msg.delta?.['cell'];
      if (!cell) return;

      this.snapshotCells.update((cells) => {
        const exists = cells.some((c) => c.id === cell.id);
        return exists ? cells : [...cells, cell];
      });
      return;
    }

    if (msg.opType === 'MOVE_COMMIT') {
      this.snapshotCells.update((cells) =>
        cells.map((cell) =>
          cell.id === msg.cellId
            ? {
                ...cell,
                position: {
                  x: msg.delta['x'],
                  y: msg.delta['y'],
                },
              }
            : cell,
        ),
      );
      return;
    }

    if (msg.opType === 'UPDATE_NODE' || msg.opType === 'UPDATE_LINK') {
      this.snapshotCells.update((cells) =>
        cells.map((cell) => {
          if (cell.id !== msg.cellId) return cell;

          return {
            ...cell,
            ...(msg.delta['position'] ? { position: msg.delta['position'] } : {}),
            ...(msg.delta['size'] ? { size: msg.delta['size'] } : {}),
            ...(msg.delta['source'] ? { source: msg.delta['source'] } : {}),
            ...(msg.delta['target'] ? { target: msg.delta['target'] } : {}),
            ...(msg.delta['attrs'] ? { attrs: msg.delta['attrs'] } : {}),
            ...(msg.delta['customData'] ? { customData: msg.delta['customData'] } : {}),
          };
        }),
      );
      return;
    }

    if (msg.opType === 'DELETE_CELL' || msg.opType === 'DELETE_LINK') {
      this.snapshotCells.update((cells) => {
        const targetCell = cells.find((c) => c.id === msg.cellId);

        if (!targetCell) {
          return cells;
        }

        const isNode = targetCell.type !== 'standard.Link';

        if (!isNode) {
          return cells.filter((c) => c.id !== msg.cellId);
        }

        return cells.filter((c) => {
          if (c.id === msg.cellId) {
            return false;
          }

          const isRelatedLink =
            c.type === 'standard.Link' &&
            (c.source?.id === msg.cellId || c.target?.id === msg.cellId);

          return !isRelatedLink;
        });
      });

      return;
    }
  }

  createNode(): void {
    const cellId = `node-${Date.now()}`;
    this.selectedCellId.set(cellId);
    this.syncService.CREATE_NODE(cellId, this.currentUserId(), 100, 100);
  }

  lockCell(): void {
    this.syncService.LOCK_CELL(this.selectedCellId(), this.currentUserId());
  }

  unlockCell(): void {
    this.syncService.UNLOCK_CELL(this.selectedCellId(), this.currentUserId());
  }

  moveLive(): void {
    this.syncService.MOVE_LIVE(this.selectedCellId(), this.currentUserId(), 250, 180);
  }

  moveCommit(): void {
    this.syncService.MOVE_COMMIT(this.selectedCellId(), this.currentUserId(), 250, 180);
  }

  updateNode(): void {
    this.syncService.UPDATE_NODE(this.selectedCellId(), this.currentUserId(), this.labelText());
  }

  createLink(): void {
    const linkId = `link-${Date.now()}`;
    this.syncService.CREATE_LINK(
      linkId,
      this.selectedCellId(),
      this.selectedTargetId(),
      this.currentUserId(),
    );
  }

  deleteCell(): void {
    this.syncService.DELETE_CELL(this.selectedCellId(), this.currentUserId());
  }

  sendPing(): void {
    this.syncService.SEND_PING(this.currentUserId(), 320, 220);
  }

  private addLog(text: string): void {
    this.logs.update((current) => [`${new Date().toLocaleTimeString()} - ${text}`, ...current]);
  }
}
