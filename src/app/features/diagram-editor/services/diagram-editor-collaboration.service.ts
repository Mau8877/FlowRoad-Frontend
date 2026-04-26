import { Injectable, inject, signal } from '@angular/core';
import { Subscription } from 'rxjs';

import { AuthService } from '../../auth/services/auth.service';
import {
  Diagram,
  DiagramCell,
  DiagramLane,
  DiagramNodeType,
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
import { DiagramEditorUiService } from './diagram-editor-ui.service';
import { DiagramSyncService } from './diagram-sync.service';
import { DiagramService } from './diagram.service';

@Injectable()
export class DiagramEditorCollaborationService {
  private readonly diagramService = inject(DiagramService);
  private readonly syncService = inject(DiagramSyncService);
  private readonly authService = inject(AuthService);
  private readonly uiService = inject(DiagramEditorUiService);

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
  public inspectorCellId = signal('');
  public selectedTargetId = signal('');
  public labelText = signal('Actividad Editada');

  // Estado exclusivo para LINK
  public linkDraftSourceId = signal('');

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
        this.handleElementSelection(cellId, label);
      },

      onCellDoubleClicked: (cellId: string, label: string) => {
        this.handleElementDoubleClick(cellId, label);
      },

      onBlankPointerDown: (x: number, y: number) => {
        this.handleBlankPointerDown(x, y);
      },

      onElementPointerDown: (cellId: string, position: { x: number; y: number }) => {
        this.handleElementPointerDown(cellId, position);
      },

      onElementResizePreview: (cellId: string, width: number, height: number) => {
        return this.handleElementResizePreview(cellId, width, height);
      },

      onElementResizeCommit: (cellId: string, width: number, height: number) => {
        this.handleElementResizeCommit(cellId, width, height);
      },

      onElementDragStart: (cellId: string, position: { x: number; y: number }) => {
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

      isPanMode: () => {
        return this.uiService.activeTool() === 'PAN';
      },

      isSelectMode: () => {
        return this.uiService.activeTool() === 'SELECT';
      },

      getDebugLinkState: () => ({
        activeTool: this.uiService.activeTool(),
        selectedCellId: this.selectedCellId(),
        linkDraftSourceId: this.linkDraftSourceId(),
        selectedTargetId: this.selectedTargetId(),
      }),
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
    this.linkDraftSourceId.set('');
  }

  createNode(): void {
    const initialPosition = this.laneService.getDefaultCreatePosition();
    if (!initialPosition) {
      this.addLog('No hay lanes configuradas para crear nodos.');
      return;
    }

    this.createNodeAt(initialPosition.x, initialPosition.y, 'ACTION');
  }

  clearSelection(): void {
    const selectedId = this.selectedCellId();
    const selectedCell = selectedId ? this.snapshotStore.findCell(selectedId) : undefined;

    this.canvasManager?.clearSelection(selectedCell);
    this.selectedCellId.set('');
    this.inspectorCellId.set('');
    this.selectedTargetId.set('');
  }

  cancelCurrentAction(options?: { clearSelectionInLink?: boolean }): void {
    if (this.uiService.activeTool() === 'LINK') {
      this.resetLinkDraft(options?.clearSelectionInLink ?? false);
      return;
    }

    this.clearSelection();
  }

  deleteSelectedCell(): void {
    const activeTool = this.uiService.activeTool();
    if (activeTool === 'PAN') return;
    if (!this.selectedCellId()) return;

    this.deleteCell();
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

  updateNode(payload?: {
    label: string;
    width?: number;
    height?: number;
    templateDocumentId?: string;
  }): void {
    const cellId = this.selectedCellId();
    if (!cellId) return;

    const selectedCell = this.snapshotStore.findCell(cellId);
    if (!selectedCell || selectedCell.type === 'standard.Link') return;
    const isInitialNode =
      String(selectedCell.customData?.['tipo'] ?? '').toUpperCase() === 'INITIAL';

    const nextLabelRaw = payload?.label ?? this.labelText();
    const nextLabel = isInitialNode ? '' : nextLabelRaw;
    const nextWidth = payload?.width ?? selectedCell.size?.width;
    const nextHeight = payload?.height ?? selectedCell.size?.height;
    const nextTemplateDocumentId =
      payload?.templateDocumentId ?? selectedCell.customData?.['templateDocumentId'] ?? '';

    this.labelText.set(nextLabel);

    this.syncService.UPDATE_NODE(cellId, this.currentUserId(), {
      label: nextLabel,
      ...(nextWidth !== undefined ? { width: nextWidth } : {}),
      ...(nextHeight !== undefined ? { height: nextHeight } : {}),
      templateDocumentId: nextTemplateDocumentId,
    });
  }

  updateLinkLabel(label: string): void {
    const cellId = this.selectedCellId();
    if (!cellId) return;

    const selectedCell = this.snapshotStore.findCell(cellId);
    if (!selectedCell || selectedCell.type !== 'standard.Link') return;

    const nextLabel = label.trim();
    const nextLabels = this.buildLinkLabels(nextLabel);

    // Optimistic local update so the label becomes visible immediately.
    this.snapshotStore.update((cells) =>
      cells.map((cell) =>
        cell.id === cellId
          ? {
              ...cell,
              labels: nextLabels,
              customData: {
                ...(cell.customData ?? {}),
                linkLabel: nextLabel,
              },
            }
          : cell,
      ),
    );

    this.canvasManager?.applyUpdate(cellId, {
      labels: nextLabels,
      customData: {
        ...(selectedCell.customData ?? {}),
        linkLabel: nextLabel,
      },
    });

    this.syncService.UPDATE_LINK(cellId, this.currentUserId(), {
      label: nextLabel,
      customData: selectedCell.customData ?? {},
    });
  }

  getSelectedCell(): DiagramCell | null {
    const cellId = this.inspectorCellId();
    if (!cellId) return null;

    return this.snapshotStore.findCell(cellId) ?? null;
  }

  createLink(sourceId: string, targetId: string): void {
    if (!sourceId || !targetId) return;

    if (sourceId === targetId) {
      this.addLog('No se permiten self-links (A→A).');
      return;
    }

    if (this.hasLinkBetween(sourceId, targetId)) {
      this.addLog(`Link duplicado evitado: ${sourceId} → ${targetId}`);
      return;
    }

    const linkId = `link-${Date.now()}`;
    this.syncService.CREATE_LINK(linkId, sourceId, targetId, this.currentUserId());

    this.resetLinkDraft(false);
  }

  deleteCell(): void {
    if (!this.selectedCellId()) return;
    this.syncService.DELETE_CELL(this.selectedCellId(), this.currentUserId());
  }

  sendPing(): void {
    this.syncService.SEND_PING(this.currentUserId(), 320, 220);
  }

  previewLaneResize(laneId: string, nextWidth: number): void {
    const previousLanes = [...this.uiService.lanes()].map((lane) => ({ ...lane }));
    const nextLanes = this.uiService.resizeLaneWidth(laneId, nextWidth);

    this.syncNodesWithLaneLayout(previousLanes, nextLanes, false);
  }

  previewLaneReorder(laneId: string, pointerCanvasX: number): void {
    const previousLanes = [...this.uiService.lanes()].map((lane) => ({ ...lane }));
    const nextLanes = this.uiService.reorderLaneByPointer(laneId, pointerCanvasX);

    this.syncNodesWithLaneLayout(previousLanes, nextLanes, false);
  }

  commitLaneLayoutChange(successLog = 'Lanes actualizadas'): void {
    this.recomputeLaneHeightsFromNodes(false);
    this.syncCurrentLanes(successLog);
  }

  recomputeLaneHeightsFromNodes(persist = false): void {
    const before = [...this.uiService.lanes()].map((lane) => ({ ...lane }));
    const nodeBottoms = this.snapshotStore.getLaneNodeBottoms();
    const after = this.uiService.applyAutoHeightsFromNodeBottoms(nodeBottoms);

    this.snapshotStore.clampNodesIntoLanes(after, this.uiService.laneHeaderHeightPx);

    if (persist && this.didLaneLayoutChange(before, after)) {
      this.syncCurrentLanes('Altura automática de lanes actualizada');
    }
  }

  public syncCurrentLanes(successLog?: string): void {
    this.syncService.SYNC_LANES(this.currentUserId(), this.uiService.lanes(), this.snapshotCells());

    if (successLog) {
      this.addLog(successLog);
    }
  }

  private handleBlankPointerDown(x: number, y: number): void {
    const activeTool = this.uiService.activeTool();

    if (activeTool === 'SELECT') {
      this.clearSelection();
      return;
    }

    if (activeTool === 'LINK') {
      this.resetLinkDraft();
      return;
    }

    switch (activeTool) {
      case 'LANE':
        this.createLane();
        return;

      case 'INITIAL':
        this.createNodeAt(x, y, 'INITIAL');
        return;

      case 'ACTION':
        this.createNodeAt(x, y, 'ACTION');
        return;

      case 'DECISION':
        this.createNodeAt(x, y, 'DECISION');
        return;

      case 'FORK_JOIN':
        this.createNodeAt(x, y, 'FORK');
        return;

      case 'FINAL':
        this.createNodeAt(x, y, 'FINAL');
        return;

      default:
        void x;
        void y;
        return;
    }
  }

  private handleElementPointerDown(cellId: string, position: { x: number; y: number }): void {
    const activeTool = this.uiService.activeTool();
    const cell = this.snapshotStore.findCell(cellId);

    if (!cell) {
      return;
    }

    if (activeTool === 'SELECT') {
      this.selectedCellId.set(cellId);
      this.inspectorCellId.set('');
      this.canvasManager?.selectCell(cellId, cell);

      if (cell.type !== 'standard.Link') {
        const label = String(cell.attrs?.['label']?.['text'] ?? cell.customData?.['nombre'] ?? '');
        if (label.trim()) {
          this.labelText.set(label);
        }
      }

      void position;
      return;
    }

    if (activeTool === 'LINK') {
      if (cell.type === 'standard.Link') {
        return;
      }

      this.handleLinkPointerDown(cellId);
      return;
    }

    void position;
  }

  private handleElementSelection(cellId: string, label: string): void {
    const activeTool = this.uiService.activeTool();
    const cell = this.snapshotStore.findCell(cellId);

    if (activeTool === 'PAN') {
      return;
    }

    if (activeTool === 'SELECT') {
      if (!cell) {
        return;
      }

      this.selectedCellId.set(cellId);
      this.inspectorCellId.set('');
      this.canvasManager?.selectCell(cellId, cell);

      if (cell.type !== 'standard.Link') {
        const resolvedLabel = String(
          cell.attrs?.['label']?.['text'] ?? cell.customData?.['nombre'] ?? label,
        );
        if (resolvedLabel.trim()) {
          this.labelText.set(resolvedLabel);
        }
      }
      return;
    }

    if (activeTool === 'LINK') {
      return;
    }

    void cell;
    void label;
  }

  private handleElementDoubleClick(cellId: string, label: string): void {
    const activeTool = this.uiService.activeTool();
    const cell = this.snapshotStore.findCell(cellId);

    if (activeTool !== 'SELECT') {
      return;
    }

    if (!cell) {
      return;
    }

    this.selectedCellId.set(cellId);
    this.inspectorCellId.set(cellId);
    this.canvasManager?.selectCell(cellId, cell);

    if (cell.type !== 'standard.Link') {
      const resolvedLabel = String(
        cell.attrs?.['label']?.['text'] ?? cell.customData?.['nombre'] ?? label,
      );
      if (resolvedLabel.trim()) {
        this.labelText.set(resolvedLabel);
      }
    }
  }

  replaceDiagramFromImport(diagram: Diagram): void {
    console.log('replaceDiagramFromImport INPUT', diagram);
    console.log('replaceDiagramFromImport cells length', diagram.cells?.length ?? 0);
    console.log('replaceDiagramFromImport lanes length', diagram.lanes?.length ?? 0);
    console.log('replaceDiagramFromImport first cell', diagram.cells?.[0] ?? null);
    console.log('replaceDiagramFromImport first lane', diagram.lanes?.[0] ?? null);

    this.uiService.setMetadata(
      diagram.name ?? 'Diagrama de actividades',
      diagram.description ?? '',
    );
    this.uiService.setLanes(diagram.lanes ?? []);
    this.snapshotStore.setSnapshot(Array.isArray(diagram.cells) ? diagram.cells : []);
    console.log('snapshotStore after import', this.snapshotStore.cells());

    this.dragSession.reset();
    this.lockState.reset();
    this.lastLiveSentAt = 0;
    this.resetLinkDraft(false);
    this.clearSelection();

    this.renderSnapshot();
    console.log('renderSnapshot executed after import');
  }

  private handleElementResizePreview(
    cellId: string,
    width: number,
    height: number,
  ): { width: number; height: number } {
    const next = this.resolveResizeWithinLane(cellId, width, height);
    this.canvasManager?.applyResize(cellId, next.width, next.height);
    return next;
  }

  private handleElementResizeCommit(cellId: string, width: number, height: number): void {
    const next = this.resolveResizeWithinLane(cellId, width, height);
    const cell = this.snapshotStore.findCell(cellId);

    if (!cell || cell.type === 'standard.Link') {
      return;
    }

    const currentWidth = Number(cell.size?.width ?? 160);
    const currentHeight = Number(cell.size?.height ?? 60);

    this.canvasManager?.applyResize(cellId, next.width, next.height);

    if (currentWidth === next.width && currentHeight === next.height) {
      return;
    }

    this.snapshotStore.update((cells) =>
      cells.map((current) =>
        current.id === cellId
          ? {
              ...current,
              size: {
                width: next.width,
                height: next.height,
              },
            }
          : current,
      ),
    );

    const isInitialNode = String(cell.customData?.['tipo'] ?? '').toUpperCase() === 'INITIAL';
    const label = isInitialNode
      ? ''
      : String(cell.attrs?.['label']?.['text'] ?? cell.customData?.['nombre'] ?? this.labelText());
    const templateDocumentId = String(cell.customData?.['templateDocumentId'] ?? '');

    this.syncService.UPDATE_NODE(cellId, this.currentUserId(), {
      label: isInitialNode ? '' : label.trim() || 'Sin nombre',
      width: next.width,
      height: next.height,
      templateDocumentId,
    });
  }

  private createLane(): void {
    const departmentId = this.uiService.selectedLaneDepartmentId();

    if (!departmentId) {
      this.addLog('Selecciona un department antes de crear la lane');
      return;
    }

    const department = this.uiService.getDepartmentById(departmentId);
    if (!department) {
      this.addLog('Department no encontrado para crear lane');
      return;
    }

    const lane = this.uiService.addLaneFromDepartment(department);

    if (!lane) {
      this.addLog('Ese department ya tiene lane en el diagrama');
      return;
    }

    this.syncCurrentLanes(`Lane creada: ${lane.departmentName}`);
  }

  private startDragLock(cellId: string, position: { x: number; y: number }): void {
    if (this.uiService.activeTool() !== 'SELECT') {
      return;
    }

    const cell = this.snapshotStore.findCell(cellId);
    if (!cell || cell.type === 'standard.Link') {
      return;
    }

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
    this.canvasManager?.selectCell(cellId, cell);
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

        try {
          const parsedLanes = response.lanesSnapshot ? JSON.parse(response.lanesSnapshot) : [];
          this.uiService.setLanes(parsedLanes);
        } catch {
          this.uiService.setLanes([]);
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

    const selectedId = this.selectedCellId();
    if (selectedId) {
      this.canvasManager?.selectCell(selectedId, this.snapshotStore.findCell(selectedId));
    }

    if (this.linkDraftSourceId()) {
      this.canvasManager?.setLinkSource(this.linkDraftSourceId());
      this.canvasManager?.startLinkPreview(this.linkDraftSourceId());
    }

    this.recomputeLaneHeightsFromNodes(false);
  }

  private applyIncomingMessage(msg: SocketOperationMessage): void {
    if (msg.opType === 'SYNC_LANES') {
      const incomingLanes = ((msg.delta['lanes'] as DiagramLane[] | undefined) ?? []).map(
        (lane) => ({ ...lane }),
      );
      const incomingCells = (msg.delta['cells'] as DiagramCell[] | undefined) ?? [];
      const incomingName =
        (msg.delta['name'] as string | undefined) ?? this.uiService.diagramName();
      const incomingDescription =
        (msg.delta['description'] as string | undefined) ?? this.uiService.diagramDescription();

      this.uiService.setMetadata(incomingName, incomingDescription);
      this.uiService.setLanes(incomingLanes);
      this.snapshotStore.setSnapshot(incomingCells);
      this.canvasManager?.clearAndRender(this.snapshotCells());

      const selectedId = this.selectedCellId();
      if (selectedId) {
        this.canvasManager?.selectCell(selectedId, this.snapshotStore.findCell(selectedId));
      }

      this.recomputeLaneHeightsFromNodes(false);
      return;
    }

    const result = this.messageHandler.handleIncomingMessage(msg, {
      currentUserId: this.currentUserId(),
      selectedCellId: this.selectedCellId(),
      canvasManager: this.canvasManager,
      addLog: (text) => this.addLog(text),
    });

    this.applyMessageHandlerResult(result);

    if (
      msg.opType === 'CREATE_NODE' ||
      msg.opType === 'MOVE_COMMIT' ||
      msg.opType === 'UPDATE_NODE' ||
      msg.opType === 'DELETE_CELL' ||
      msg.opType === 'CREATE_LINK' ||
      msg.opType === 'UPDATE_LINK' ||
      msg.opType === 'DELETE_LINK'
    ) {
      this.recomputeLaneHeightsFromNodes(msg.userId === this.currentUserId());
    }

    const selectedId = this.selectedCellId();
    if (selectedId) {
      this.canvasManager?.selectCell(selectedId, this.snapshotStore.findCell(selectedId));
    }
  }

  private applyMessageHandlerResult(result: DiagramEditorMessageHandlerResult): void {
    if (result.shouldResetDrag) {
      this.lastLiveSentAt = 0;
    }

    if (result.shouldClearSelectedCell) {
      this.clearSelection();
    }

    if (result.finishDragPosition !== undefined) {
      this.finishActiveDrag(result.finishDragPosition?.x, result.finishDragPosition?.y);
    }
  }

  private createNodeAt(x: number, y: number, nodeType: DiagramNodeType): void {
    const lane = this.laneService.resolveLaneForPoint(x, y);
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
      nodeType,
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

    const resolvedLane = this.laneService.resolveLaneForPoint(x, y);
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

  private syncNodesWithLaneLayout(
    previousLanes: DiagramLane[],
    nextLanes: DiagramLane[],
    recomputeHeights: boolean,
  ): void {
    const previousById = new Map(previousLanes.map((lane) => [lane.id, lane]));
    const offsetsByLaneId: Record<string, number> = {};

    for (const lane of nextLanes) {
      const previous = previousById.get(lane.id);
      if (!previous) continue;

      offsetsByLaneId[lane.id] = lane.x - previous.x;
    }

    const movedByOffset = this.snapshotStore.moveNodesByLaneOffsets(offsetsByLaneId);
    const clamped = this.snapshotStore.clampNodesIntoLanes(
      nextLanes,
      this.uiService.laneHeaderHeightPx,
    );

    const latestByCellId = new Map<string, { x: number; y: number }>();

    for (const moved of movedByOffset) {
      latestByCellId.set(moved.cellId, { x: moved.x, y: moved.y });
    }

    for (const moved of clamped) {
      latestByCellId.set(moved.cellId, { x: moved.x, y: moved.y });
    }

    for (const [cellId, position] of latestByCellId.entries()) {
      this.canvasManager?.applyMove(cellId, position.x, position.y);
    }

    if (recomputeHeights) {
      this.recomputeLaneHeightsFromNodes(false);
    }
  }

  private didLaneLayoutChange(previousLanes: DiagramLane[], nextLanes: DiagramLane[]): boolean {
    if (previousLanes.length !== nextLanes.length) return true;

    return previousLanes.some((previous, index) => {
      const next = nextLanes[index];
      if (!next) return true;

      return (
        previous.id !== next.id ||
        previous.x !== next.x ||
        previous.y !== next.y ||
        previous.width !== next.width ||
        previous.height !== next.height ||
        previous.order !== next.order
      );
    });
  }

  private handleLinkPointerDown(cellId: string): void {
    const sourceId = this.linkDraftSourceId();

    if (!sourceId) {
      if (this.selectedCellId()) {
        this.clearSelection();
      }

      this.linkDraftSourceId.set(cellId);
      this.selectedTargetId.set('');
      this.canvasManager?.clearLinkDraft();
      this.canvasManager?.setLinkSource(cellId);
      this.canvasManager?.startLinkPreview(cellId);
      return;
    }

    if (sourceId === cellId) {
      this.selectedTargetId.set('');
      this.canvasManager?.setLinkSource(cellId);
      this.canvasManager?.startLinkPreview(cellId);
      return;
    }

    this.selectedTargetId.set(cellId);
    this.canvasManager?.setLinkTarget(cellId);
    this.createLink(sourceId, cellId);
  }

  private resetLinkDraft(clearSelected = false): void {
    this.linkDraftSourceId.set('');
    this.selectedTargetId.set('');
    this.canvasManager?.clearLinkDraft();

    if (clearSelected) {
      this.clearSelection();
    }
  }

  private hasLinkBetween(sourceId: string, targetId: string): boolean {
    return this.snapshotStore
      .cells()
      .some(
        (cell) =>
          cell.type === 'standard.Link' &&
          cell.source?.id === sourceId &&
          cell.target?.id === targetId,
      );
  }

  private buildLinkLabels(label: string): Record<string, any>[] {
    if (!label) return [];

    return [
      {
        position: 0.5,
        attrs: {
          text: {
            text: label,
            fill: '#111827',
            fontSize: 12,
            fontWeight: 600,
            textAnchor: 'middle',
            yAlignment: 'middle',
          },
          rect: {
            fill: '#ffffff',
            stroke: '#cbd5e1',
            strokeWidth: 1,
            rx: 6,
            ry: 6,
          },
        },
      },
    ];
  }

  private resolveResizeWithinLane(
    cellId: string,
    width: number,
    height: number,
  ): { width: number; height: number } {
    const cell = this.snapshotStore.findCell(cellId);
    if (!cell || cell.type === 'standard.Link') {
      return {
        width: Math.max(24, Math.round(width)),
        height: Math.max(18, Math.round(height)),
      };
    }

    const position = cell.position ?? { x: 100, y: 100 };
    const laneId = cell.customData?.laneId;
    const lane =
      (laneId ? this.uiService.lanes().find((item) => item.id === laneId) : null) ??
      this.laneService.resolveLaneForPoint(position.x, position.y);

    if (!lane) {
      return {
        width: Math.max(24, Math.round(width)),
        height: Math.max(18, Math.round(height)),
      };
    }

    return this.laneService.normalizeNodeSizeToLane(position.x, position.y, lane, width, height);
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
