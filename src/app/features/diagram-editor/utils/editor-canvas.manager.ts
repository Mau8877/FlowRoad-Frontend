import { dia, shapes } from '@joint/core';
import { DiagramCell } from '../interfaces/diagram.models';

export interface CanvasManagerCallbacks {
  onCellSelected(cellId: string, label: string): void;
  onCellDoubleClicked(cellId: string, label: string): void;
  onBlankPointerDown(x: number, y: number): void;
  onElementPointerDown(cellId: string, position: { x: number; y: number }): void;
  onElementResizePreview(
    cellId: string,
    width: number,
    height: number,
  ): {
    width: number;
    height: number;
  };
  onElementResizeCommit(cellId: string, width: number, height: number): void;
  onElementDragStart(cellId: string, position: { x: number; y: number }): void;
  onElementPositionChanged(cellId: string, x: number, y: number): void;
  onElementPointerUp(cellId: string, x: number, y: number): void;
  isCellRemotelyLocked(cellId: string): boolean;
  getActiveDraggingCellId(): string | null;
  isDragTransitionLocked(): boolean;
  isPanMode(): boolean;
  isSelectMode(): boolean;
  getDebugLinkState(): {
    activeTool: string;
    selectedCellId: string;
    linkDraftSourceId: string;
    selectedTargetId: string;
  };
}

interface PendingPointerState {
  cellId: string;
  originPosition: { x: number; y: number };
  dragStarted: boolean;
}

interface ResizeSessionState {
  cellId: string;
  originSize: { width: number; height: number };
  startPointer: { x: number; y: number };
  lastSize: { width: number; height: number };
}

type HighlightMode = 'selected-node' | 'selected-link' | 'link-source' | 'link-target';

export class EditorCanvasManager {
  private graph!: dia.Graph;
  private paper!: dia.Paper;
  private resizeObserver?: ResizeObserver;
  private resizeFrame: number | null = null;
  private resizeHandleEl: HTMLDivElement | null = null;

  private pendingPointerState: PendingPointerState | null = null;
  private resizeSession: ResizeSessionState | null = null;
  private selectedCellId: string | null = null;
  private linkSourceCellId: string | null = null;
  private linkTargetCellId: string | null = null;

  private readonly previewLinkId = '__draft-link-preview__';
  private readonly resizeHandleSizePx = 14;

  private readonly handleWindowPointerUp = (): void => {
    this.finishResizeSession();
  };

  private readonly handleHostPointerMove = (event: PointerEvent): void => {
    if (this.resizeSession) {
      const point = this.getLocalPointFromClient(event.clientX, event.clientY);
      if (!point) return;

      const requestedWidth =
        this.resizeSession.originSize.width + (point.x - this.resizeSession.startPointer.x);
      const requestedHeight =
        this.resizeSession.originSize.height + (point.y - this.resizeSession.startPointer.y);

      const next = this.callbacks.onElementResizePreview(
        this.resizeSession.cellId,
        requestedWidth,
        requestedHeight,
      );

      this.resizeSession.lastSize = {
        width: next.width,
        height: next.height,
      };

      this.applyResize(this.resizeSession.cellId, next.width, next.height);
      return;
    }

    if (!this.linkSourceCellId || this.linkTargetCellId) return;

    const point = this.getLocalPointFromClient(event.clientX, event.clientY);
    if (!point) return;

    this.updateLinkPreview(point.x, point.y);
  };

  constructor(
    private readonly host: HTMLDivElement,
    private readonly callbacks: CanvasManagerCallbacks,
  ) {}

  init(): void {
    this.graph = new dia.Graph({}, { cellNamespace: shapes });

    this.host.style.width = '100%';
    this.host.style.height = '100%';
    this.host.style.position = 'relative';

    this.paper = new dia.Paper({
      el: this.host,
      model: this.graph,
      cellViewNamespace: shapes,
      async: true,
      frozen: false,
      gridSize: 20,
      drawGrid: false,
      moveThreshold: 6,
      background: {
        color: 'transparent',
      },
      interactive: (cellView) => {
        const cellId = String(cellView.model.id);

        if (cellId === this.previewLinkId) {
          return false;
        }

        if (this.callbacks.isPanMode()) {
          return false;
        }

        if (cellView.model.isLink()) {
          return false;
        }

        if (this.callbacks.isCellRemotelyLocked(cellId)) {
          return false;
        }

        const activeDraggingCellId = this.callbacks.getActiveDraggingCellId();

        if (this.callbacks.isDragTransitionLocked()) {
          return activeDraggingCellId === cellId ? { elementMove: true } : { elementMove: false };
        }

        if (!this.callbacks.isSelectMode()) {
          return { elementMove: false };
        }

        return { elementMove: true };
      },
    });

    this.registerEvents();
    this.createResizeHandle();
    this.observeResize();
    this.scheduleResize();

    this.host.addEventListener('pointermove', this.handleHostPointerMove);
  }

  destroy(): void {
    this.resizeObserver?.disconnect();

    if (this.resizeFrame !== null) {
      cancelAnimationFrame(this.resizeFrame);
      this.resizeFrame = null;
    }

    this.host.removeEventListener('pointermove', this.handleHostPointerMove);
    window.removeEventListener('pointerup', this.handleWindowPointerUp);
    window.removeEventListener('pointercancel', this.handleWindowPointerUp);
    this.resizeHandleEl?.remove();
    this.resizeHandleEl = null;

    this.pendingPointerState = null;
    this.resizeSession = null;
    this.selectedCellId = null;
    this.linkSourceCellId = null;
    this.linkTargetCellId = null;
    this.paper?.remove();
  }

  clearAndRender(cells: DiagramCell[]): void {
    this.graph.clear();

    for (const cell of cells) {
      if (cell.id === this.previewLinkId) continue;

      const jointCell = this.buildJointCell(cell);
      if (jointCell) {
        this.graph.addCell(jointCell);
      }
    }

    this.reapplyHighlights();

    if (this.linkSourceCellId && !this.linkTargetCellId) {
      this.startLinkPreview(this.linkSourceCellId);
    }

    this.scheduleResize();
  }

  addCell(cell: DiagramCell): void {
    if (cell.id === this.previewLinkId) return;
    if (this.graph.getCell(cell.id)) return;

    const jointCell = this.buildJointCell(cell);
    if (jointCell) {
      this.graph.addCell(jointCell);
    }

    this.reapplyHighlights();
  }

  applyMove(cellId: string, x: number, y: number): void {
    const cell = this.graph.getCell(cellId);

    if (cell && !cell.isLink()) {
      const element = cell as dia.Element;
      element.position(x, y);
      if (this.selectedCellId === cellId) {
        this.updateResizeHandle();
      }
    }
  }

  applyResize(cellId: string, width: number, height: number): void {
    const cell = this.graph.getCell(cellId);
    if (!cell || cell.isLink()) return;

    const element = cell as dia.Element;
    element.resize(width, height);
    if (this.selectedCellId === cellId) {
      this.updateResizeHandle();
    }
  }

  applyUpdate(cellId: string, delta: Record<string, any>): void {
    if (cellId === this.previewLinkId) return;

    const jointCell = this.graph.getCell(cellId);
    if (!jointCell) return;

    const hasKey = (key: string) => Object.prototype.hasOwnProperty.call(delta, key);

    if (hasKey('position') && !jointCell.isLink()) {
      const element = jointCell as dia.Element;
      element.position(delta['position'].x, delta['position'].y);
    }

    if (hasKey('size') && !jointCell.isLink()) {
      const element = jointCell as dia.Element;
      element.resize(delta['size'].width, delta['size'].height);
    }

    if (hasKey('attrs')) {
      if (this.isInitialNodeCell(jointCell, delta['customData'])) {
        const incomingAttrs = (delta['attrs'] as Record<string, any> | undefined) ?? {};
        const incomingBody = (incomingAttrs['body'] as Record<string, any> | undefined) ?? {};
        const incomingLabel = (incomingAttrs['label'] as Record<string, any> | undefined) ?? {};

        jointCell.attr({
          ...incomingAttrs,
          body: {
            ...incomingBody,
            fill: '#111827',
            stroke: '#111827',
            strokeWidth: 2,
          },
          label: {
            ...incomingLabel,
            text: '',
          },
        });
      } else if (!jointCell.isLink()) {
        jointCell.attr(this.withWrappedNodeLabel(delta['attrs'] as Record<string, any>));
      } else {
        jointCell.attr(delta['attrs']);
      }
    }

    if (hasKey('source') && jointCell.isLink()) {
      jointCell.set('source', delta['source']);
    }

    if (hasKey('target') && jointCell.isLink()) {
      jointCell.set('target', delta['target']);
    }

    if (hasKey('vertices') && jointCell.isLink()) {
      jointCell.set('vertices', delta['vertices']);
    }

    if (hasKey('labels') && jointCell.isLink()) {
      jointCell.set('labels', delta['labels']);
    }

    if (
      !hasKey('labels') &&
      delta['customData']?.['linkLabel'] !== undefined &&
      jointCell.isLink()
    ) {
      jointCell.set(
        'labels',
        this.buildLinkLabelsFromText(String(delta['customData']['linkLabel'] ?? '')),
      );
    }

    if (hasKey('router') && jointCell.isLink()) {
      jointCell.set('router', delta['router']);
    }

    if (hasKey('connector') && jointCell.isLink()) {
      jointCell.set('connector', delta['connector']);
    }

    if (hasKey('customData')) {
      jointCell.set('customData', delta['customData']);
    }

    if (this.isInitialNodeCell(jointCell, delta['customData'])) {
      this.forceInitialNodeVisual(jointCell as dia.Element);
    }

    this.reapplyHighlights();
  }

  applyDelete(cellId: string): void {
    const targetCell = this.graph.getCell(cellId);
    if (!targetCell) return;

    if (this.selectedCellId === cellId) this.selectedCellId = null;
    if (this.linkSourceCellId === cellId) this.linkSourceCellId = null;
    if (this.linkTargetCellId === cellId) this.linkTargetCellId = null;

    if (targetCell.isLink()) {
      targetCell.remove();
      return;
    }

    const connectedLinks = this.graph.getConnectedLinks(targetCell);
    connectedLinks.forEach((link) => {
      if (this.selectedCellId === String(link.id)) {
        this.selectedCellId = null;
      }
      link.remove();
    });

    targetCell.remove();
  }

  restoreElementPosition(cellId: string, x: number, y: number): void {
    const cell = this.graph.getCell(cellId);
    if (!cell || cell.isLink()) return;

    const element = cell as dia.Element;
    element.position(x, y);
  }

  getElementPosition(cellId: string): { x: number; y: number } | null {
    const cell = this.graph.getCell(cellId);
    if (!cell || cell.isLink()) return null;

    const element = cell as dia.Element;
    const position = element.position();

    return {
      x: position.x,
      y: position.y,
    };
  }

  selectCell(cellId: string, snapshotCell?: DiagramCell): void {
    if (this.selectedCellId && this.selectedCellId !== cellId) {
      this.clearSelection(undefined, this.selectedCellId);
    }

    this.selectedCellId = cellId;
    const mode: HighlightMode =
      snapshotCell?.type === 'standard.Link' ? 'selected-link' : 'selected-node';
    this.paintHighlight(cellId, mode);
    this.updateResizeHandle();
  }

  clearSelection(snapshotCell?: DiagramCell, explicitCellId?: string): void {
    const cellId = explicitCellId ?? this.selectedCellId;
    if (!cellId) return;

    this.restoreCellVisual(cellId, snapshotCell);

    if (!explicitCellId || explicitCellId === this.selectedCellId) {
      this.selectedCellId = null;
    }
    this.updateResizeHandle();
  }

  setLinkSource(cellId: string): void {
    if (this.linkSourceCellId && this.linkSourceCellId !== cellId) {
      this.restoreCellVisual(this.linkSourceCellId);
    }

    this.linkSourceCellId = cellId;
    this.paintHighlight(cellId, 'link-source');
  }

  setLinkTarget(cellId: string): void {
    if (this.linkTargetCellId && this.linkTargetCellId !== cellId) {
      this.restoreCellVisual(this.linkTargetCellId);
    }

    this.linkTargetCellId = cellId;
    this.paintHighlight(cellId, 'link-target');
  }

  startLinkPreview(sourceCellId: string): void {
    const sourceCell = this.graph.getCell(sourceCellId);
    if (!sourceCell || sourceCell.isLink()) return;

    const element = sourceCell as dia.Element;
    const bbox = element.getBBox();

    const startX = bbox.x + bbox.width / 2;
    const startY = bbox.y + bbox.height / 2;

    const existing = this.graph.getCell(this.previewLinkId);
    if (existing) {
      existing.remove();
    }

    const previewLink = new shapes.standard.Link({
      id: this.previewLinkId,
      source: { x: startX, y: startY },
      target: { x: startX, y: startY },
      attrs: {
        line: {
          stroke: '#0f766e',
          strokeWidth: 2,
          strokeDasharray: '6 4',
          pointerEvents: 'none',
          targetMarker: {
            type: 'path',
            d: 'M 10 -5 0 0 10 5 z',
          },
        },
        wrapper: {
          pointerEvents: 'none',
        },
      },
      z: 999,
    });

    previewLink.set('interactive', false);
    previewLink.set('customData', { preview: true });

    this.graph.addCell(previewLink);
  }

  updateLinkPreview(targetX: number, targetY: number): void {
    const preview = this.graph.getCell(this.previewLinkId);
    if (!preview || !preview.isLink()) return;

    preview.set('target', {
      x: targetX,
      y: targetY,
    });
  }

  clearLinkDraft(): void {
    const sourceId = this.linkSourceCellId;
    const targetId = this.linkTargetCellId;

    this.linkSourceCellId = null;
    this.linkTargetCellId = null;

    const preview = this.graph.getCell(this.previewLinkId);
    if (preview) {
      preview.remove();
    }

    if (sourceId) this.restoreCellVisual(sourceId);
    if (targetId && targetId !== sourceId) this.restoreCellVisual(targetId);

    this.reapplyHighlights();
  }

  paintLockState(cellId: string, owner: 'local' | 'remote'): void {
    const cell = this.graph.getCell(cellId);
    if (!cell || cell.isLink()) return;

    if (owner === 'local') {
      cell.attr('body/stroke', '#cc9e61');
      cell.attr('body/strokeWidth', 3);
    } else {
      cell.attr('body/stroke', '#dc2626');
      cell.attr('body/strokeWidth', 3);
    }
  }

  clearLockState(snapshotCell?: DiagramCell): void {
    if (!snapshotCell) return;

    const cell = this.graph.getCell(snapshotCell.id);
    if (!cell || cell.isLink()) return;

    this.restoreCellVisual(snapshotCell.id, snapshotCell);
    this.reapplyHighlights();
  }

  private reapplyHighlights(): void {
    if (this.selectedCellId) {
      const selected = this.graph.getCell(this.selectedCellId);
      if (selected) {
        this.paintHighlight(
          this.selectedCellId,
          selected.isLink() ? 'selected-link' : 'selected-node',
        );
      }
    }

    if (this.linkSourceCellId) {
      this.paintHighlight(this.linkSourceCellId, 'link-source');
    }

    if (this.linkTargetCellId) {
      this.paintHighlight(this.linkTargetCellId, 'link-target');
    }

    this.updateResizeHandle();
  }

  private paintHighlight(cellId: string, mode: HighlightMode): void {
    const cell = this.graph.getCell(cellId);
    if (!cell) return;

    if (cell.isLink()) {
      if (mode === 'selected-link') {
        cell.attr('line/stroke', '#7c3aed');
        cell.attr('line/strokeWidth', 4);
      }
      return;
    }

    if (mode === 'selected-node') {
      cell.attr('body/stroke', '#7c3aed');
      cell.attr('body/strokeWidth', 4);
      return;
    }

    if (mode === 'link-source') {
      cell.attr('body/stroke', '#0f766e');
      cell.attr('body/strokeWidth', 4);
      return;
    }

    if (mode === 'link-target') {
      cell.attr('body/stroke', '#ea580c');
      cell.attr('body/strokeWidth', 4);
    }
  }

  private restoreCellVisual(cellId: string, snapshotCell?: DiagramCell): void {
    const cell = this.graph.getCell(cellId);
    if (!cell) return;

    if (cell.isLink()) {
      const stroke =
        snapshotCell?.attrs?.['line']?.['stroke'] ??
        snapshotCell?.attrs?.['body']?.['stroke'] ??
        '#334155';
      const strokeWidth =
        snapshotCell?.attrs?.['line']?.['strokeWidth'] ??
        snapshotCell?.attrs?.['body']?.['strokeWidth'] ??
        2;

      cell.attr('line/stroke', stroke);
      cell.attr('line/strokeWidth', strokeWidth);
      return;
    }

    if (this.isInitialNodeCell(cell, snapshotCell?.customData)) {
      this.forceInitialNodeVisual(cell as dia.Element);
      return;
    }

    const bodyStroke =
      snapshotCell?.attrs?.['body']?.['stroke'] ||
      (this.callbacks.isCellRemotelyLocked(cellId) ? '#dc2626' : '#2563eb');
    const bodyStrokeWidth =
      snapshotCell?.attrs?.['body']?.['strokeWidth'] ||
      (this.callbacks.isCellRemotelyLocked(cellId) ? 3 : 2);

    cell.attr('body/stroke', bodyStroke);
    cell.attr('body/strokeWidth', bodyStrokeWidth);
  }

  private registerEvents(): void {
    this.paper.on('cell:pointerclick', (cellView) => {
      const cellId = String(cellView.model.id);

      if (cellId === this.previewLinkId) {
        return;
      }

      const label = cellView.model.attr('label/text') || '';
      this.callbacks.onCellSelected(cellId, String(label));
    });

    this.paper.on('cell:pointerdblclick', (cellView) => {
      const cellId = String(cellView.model.id);

      if (cellId === this.previewLinkId) {
        return;
      }

      const label = cellView.model.attr('label/text') || '';
      this.callbacks.onCellDoubleClicked(cellId, String(label));
    });

    this.paper.on('blank:pointerdown', (_evt, x, y) => {
      this.pendingPointerState = null;
      this.callbacks.onBlankPointerDown(x, y);
    });

    this.paper.on('element:pointerdown', (elementView, evt, x, y) => {
      const cellId = String(elementView.model.id);

      if (cellId === this.previewLinkId) {
        return;
      }

      const element = elementView.model as dia.Element;
      const position = element.position();
      const size = element.size();

      if (this.shouldStartResize(cellId, x, y, position, size.width, size.height)) {
        evt.preventDefault();
        evt.stopPropagation();

        this.pendingPointerState = null;
        this.resizeSession = {
          cellId,
          originSize: {
            width: Number(size.width ?? 160),
            height: Number(size.height ?? 60),
          },
          startPointer: { x, y },
          lastSize: {
            width: Number(size.width ?? 160),
            height: Number(size.height ?? 60),
          },
        };

        window.addEventListener('pointerup', this.handleWindowPointerUp);
        window.addEventListener('pointercancel', this.handleWindowPointerUp);
        return;
      }

      this.pendingPointerState = {
        cellId,
        originPosition: {
          x: position.x,
          y: position.y,
        },
        dragStarted: false,
      };

      this.callbacks.onElementPointerDown(cellId, {
        x: position.x,
        y: position.y,
      });
    });

    this.paper.on('element:pointermove', (elementView) => {
      if (this.resizeSession) {
        return;
      }

      const cellId = String(elementView.model.id);

      if (cellId === this.previewLinkId) {
        return;
      }

      const element = elementView.model as dia.Element;

      if (this.linkSourceCellId && !this.linkTargetCellId) {
        const bbox = element.getBBox();
        this.updateLinkPreview(bbox.x + bbox.width / 2, bbox.y + bbox.height / 2);
      }

      if (!this.pendingPointerState) return;
      if (this.pendingPointerState.cellId !== cellId) return;
      if (this.pendingPointerState.dragStarted) return;

      this.pendingPointerState.dragStarted = true;

      this.callbacks.onElementDragStart(cellId, {
        x: this.pendingPointerState.originPosition.x,
        y: this.pendingPointerState.originPosition.y,
      });

      const currentPosition = element.position();
      if (
        currentPosition.x !== this.pendingPointerState.originPosition.x ||
        currentPosition.y !== this.pendingPointerState.originPosition.y
      ) {
        this.callbacks.onElementPositionChanged(cellId, currentPosition.x, currentPosition.y);
      }
    });

    this.graph.on('change:position', (cell) => {
      if (cell.isLink()) return;
      if (String(cell.id) === this.previewLinkId) return;

      const element = cell as dia.Element;
      const position = element.position();

      this.callbacks.onElementPositionChanged(String(element.id), position.x, position.y);
    });

    this.paper.on('element:pointerup', (elementView) => {
      const cellId = String(elementView.model.id);

      if (cellId === this.previewLinkId) {
        return;
      }

      const element = elementView.model as dia.Element;
      const position = element.position();

      this.callbacks.onElementPointerUp(cellId, position.x, position.y);
      this.pendingPointerState = null;
    });
  }

  private shouldStartResize(
    cellId: string,
    pointerX: number,
    pointerY: number,
    position: { x: number; y: number },
    width: number,
    height: number,
  ): boolean {
    if (!this.callbacks.isSelectMode()) return false;
    if (this.selectedCellId !== cellId) return false;

    const right = position.x + width;
    const bottom = position.y + height;

    return (
      pointerX >= right - this.resizeHandleSizePx && pointerY >= bottom - this.resizeHandleSizePx
    );
  }

  private finishResizeSession(): void {
    if (!this.resizeSession) return;

    const { cellId, lastSize } = this.resizeSession;
    this.resizeSession = null;

    window.removeEventListener('pointerup', this.handleWindowPointerUp);
    window.removeEventListener('pointercancel', this.handleWindowPointerUp);

    this.callbacks.onElementResizeCommit(cellId, lastSize.width, lastSize.height);
  }

  private observeResize(): void {
    const target = this.host.parentElement ?? this.host;

    this.resizeObserver = new ResizeObserver(() => {
      this.scheduleResize();
    });

    this.resizeObserver.observe(target);
  }

  private scheduleResize(): void {
    if (this.resizeFrame !== null) {
      cancelAnimationFrame(this.resizeFrame);
    }

    this.resizeFrame = requestAnimationFrame(() => {
      this.resize();
      this.updateResizeHandle();
      this.resizeFrame = null;
    });
  }

  private resize(): void {
    const target = this.host.parentElement ?? this.host;
    const rect = target.getBoundingClientRect();

    const width = Math.max(1, Math.floor(rect.width));
    const height = Math.max(1, Math.floor(rect.height));

    this.host.style.width = '100%';
    this.host.style.height = '100%';

    if (this.paper) {
      this.paper.setDimensions(width, height);
    }
  }

  private createResizeHandle(): void {
    const handle = document.createElement('div');
    handle.className = 'editor-resize-handle';
    handle.style.position = 'absolute';
    handle.style.width = `${this.resizeHandleSizePx}px`;
    handle.style.height = `${this.resizeHandleSizePx}px`;
    handle.style.border = '2px solid #7c3aed';
    handle.style.background = '#ffffff';
    handle.style.borderRadius = '4px';
    handle.style.boxShadow = '0 2px 8px rgba(2,3,4,0.22)';
    handle.style.cursor = 'nwse-resize';
    handle.style.zIndex = '2000';
    handle.style.display = 'none';
    handle.style.pointerEvents = 'auto';

    handle.addEventListener('pointerdown', (event: PointerEvent) => {
      if (!this.selectedCellId) return;
      const selected = this.graph.getCell(this.selectedCellId);
      if (!selected || selected.isLink()) return;
      if (!this.callbacks.isSelectMode()) return;

      event.preventDefault();
      event.stopPropagation();

      const point = this.getLocalPointFromClient(event.clientX, event.clientY);
      if (!point) return;

      const element = selected as dia.Element;
      const size = element.size();

      this.resizeSession = {
        cellId: this.selectedCellId,
        originSize: {
          width: Number(size.width ?? 160),
          height: Number(size.height ?? 60),
        },
        startPointer: {
          x: point.x,
          y: point.y,
        },
        lastSize: {
          width: Number(size.width ?? 160),
          height: Number(size.height ?? 60),
        },
      };

      this.pendingPointerState = null;
      window.addEventListener('pointerup', this.handleWindowPointerUp);
      window.addEventListener('pointercancel', this.handleWindowPointerUp);
    });

    this.host.appendChild(handle);
    this.resizeHandleEl = handle;
  }

  private updateResizeHandle(): void {
    if (!this.resizeHandleEl) return;

    const selectedId = this.selectedCellId;
    if (!selectedId || !this.callbacks.isSelectMode()) {
      this.resizeHandleEl.style.display = 'none';
      return;
    }

    const selected = this.graph.getCell(selectedId);
    if (!selected || selected.isLink()) {
      this.resizeHandleEl.style.display = 'none';
      return;
    }

    if (this.callbacks.isCellRemotelyLocked(selectedId)) {
      this.resizeHandleEl.style.display = 'none';
      return;
    }

    const element = selected as dia.Element;
    const bbox = element.getBBox();
    const half = this.resizeHandleSizePx / 2;

    this.resizeHandleEl.style.left = `${bbox.x + bbox.width - half}px`;
    this.resizeHandleEl.style.top = `${bbox.y + bbox.height - half}px`;
    this.resizeHandleEl.style.display = 'block';
  }

  private getLocalPointFromClient(
    clientX: number,
    clientY: number,
  ): { x: number; y: number } | null {
    if (!this.paper) return null;

    const rect = this.host.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;

    return { x, y };
  }

  private buildJointCell(cell: DiagramCell): dia.Cell | null {
    if (cell.id === this.previewLinkId) {
      return null;
    }

    if (cell.type === 'standard.Link') {
      const defaultRouter = {
        name: 'manhattan',
        args: {
          padding: 24,
          step: 20,
        },
      };
      const defaultConnector = {
        name: 'rounded',
        args: {
          radius: 8,
        },
      };

      const link = new shapes.standard.Link({
        id: cell.id,
        source: cell.source || {},
        target: cell.target || {},
        vertices: cell.vertices || [],
        labels: this.resolveLinkLabels(cell),
        router: cell.router || defaultRouter,
        connector: cell.connector || defaultConnector,
        attrs: cell.attrs || {
          line: {
            stroke: '#475569',
            strokeWidth: 2.5,
            strokeLinecap: 'round',
            strokeLinejoin: 'round',
            targetMarker: {
              type: 'path',
              d: 'M 10 -5 0 0 10 5 z',
            },
          },
        },
      });

      link.set('customData', cell.customData || {});
      return link;
    }

    if (cell.type === 'standard.Circle') {
      const nodeType = String(cell.customData?.['tipo'] ?? '').toUpperCase();
      const isInitialNode = nodeType === 'INITIAL';
      const isFinalNode = nodeType === 'FINAL';

      if (isInitialNode) {
        const initialCircle = new shapes.standard.Circle({
          id: cell.id,
          position: cell.position || { x: 100, y: 100 },
          size: cell.size || { width: 36, height: 36 },
          attrs: {
            body: {
              fill: '#111827',
              stroke: '#111827',
              strokeWidth: 2,
            },
            label: {
              text: '',
            },
          },
        });

        initialCircle.set('customData', cell.customData || {});
        return initialCircle;
      }

      if (isFinalNode) {
        const finalCircle = new shapes.standard.Circle({
          id: cell.id,
          position: cell.position || { x: 100, y: 100 },
          size: cell.size || { width: 42, height: 42 },
          markup: [
            { tagName: 'circle', selector: 'body' },
            { tagName: 'circle', selector: 'inner' },
            { tagName: 'text', selector: 'label' },
          ],
          attrs: {
            body: {
              fill: '#ffffff',
              stroke: '#111827',
              strokeWidth: 3,
              ...(cell.attrs?.['body'] || {}),
            },
            inner: {
              ref: 'body',
              refCx: '50%',
              refCy: '50%',
              refR: '30%',
              fill: '#111827',
              stroke: '#111827',
              strokeWidth: 1,
              ...(cell.attrs?.['inner'] || {}),
            },
            label: {
              text: '',
              ...(cell.attrs?.['label'] || {}),
            },
          },
        });

        finalCircle.set('customData', cell.customData || {});
        return finalCircle;
      }

      const circle = new shapes.standard.Circle({
        id: cell.id,
        position: cell.position || { x: 100, y: 100 },
        size: cell.size || { width: 40, height: 40 },
        attrs: cell.attrs || {
          body: {
            fill: '#ffffff',
            stroke: '#111827',
            strokeWidth: 2,
          },
          label: {
            text: '',
          },
        },
      });

      circle.set('customData', cell.customData || {});
      return circle;
    }

    if (cell.type === 'standard.Polygon') {
      const polygonAttrs = this.withWrappedNodeLabel(cell.attrs, 'Decision');

      const polygon = new shapes.standard.Polygon({
        id: cell.id,
        position: cell.position || { x: 100, y: 100 },
        size: cell.size || { width: 90, height: 90 },
        attrs: {
          body: {
            refPoints: '50,0 100,50 50,100 0,50',
            fill: '#ffffff',
            stroke: '#2563eb',
            strokeWidth: 2,
          },
          ...polygonAttrs,
        },
      });

      polygon.set('customData', cell.customData || {});
      return polygon;
    }

    const rectAttrs = this.withWrappedNodeLabel(cell.attrs, 'Nueva Actividad');

    const rect = new shapes.standard.Rectangle({
      id: cell.id,
      position: cell.position || { x: 100, y: 100 },
      size: cell.size || { width: 160, height: 60 },
      attrs: {
        body: {
          fill: '#ffffff',
          stroke: '#2563eb',
          strokeWidth: 2,
          rx: 12,
          ry: 12,
        },
        ...rectAttrs,
      },
    });

    rect.set('customData', cell.customData || {});
    return rect;
  }

  private resolveLinkLabels(cell: DiagramCell): Record<string, any>[] {
    if (Array.isArray(cell.labels) && cell.labels.length > 0) {
      return cell.labels as Record<string, any>[];
    }

    const fallbackText = String(cell.customData?.['linkLabel'] ?? '').trim();
    return this.buildLinkLabelsFromText(fallbackText);
  }

  private buildLinkLabelsFromText(text: string): Record<string, any>[] {
    if (!text) return [];

    return [
      {
        position: 0.5,
        attrs: {
          text: {
            text,
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

  private withWrappedNodeLabel(
    attrs: Record<string, any> | undefined,
    fallbackText = '',
  ): Record<string, any> {
    const next = { ...(attrs ?? {}) };
    const label = { ...(next['label'] ?? {}) };
    const wrap = (label['textWrap'] as Record<string, any> | undefined) ?? {};

    if (!Object.prototype.hasOwnProperty.call(label, 'text') && fallbackText) {
      label['text'] = fallbackText;
    }

    label['fill'] = label['fill'] ?? '#111827';
    label['textWrap'] = {
      width: -16,
      height: -12,
      ellipsis: true,
      ...wrap,
    };
    label['textAnchor'] = label['textAnchor'] ?? 'middle';
    label['textVerticalAnchor'] = label['textVerticalAnchor'] ?? 'middle';
    label['refX'] = label['refX'] ?? '50%';
    label['refY'] = label['refY'] ?? '50%';
    label['xAlignment'] = label['xAlignment'] ?? 'middle';
    label['yAlignment'] = label['yAlignment'] ?? 'middle';

    next['label'] = label;
    return next;
  }
  private isInitialNodeCell(cell: dia.Cell, nextCustomData?: Record<string, any>): boolean {
    if (cell.isLink()) return false;

    const currentCustomData = (cell.get('customData') as Record<string, any> | undefined) ?? {};
    const customData = nextCustomData ?? currentCustomData;
    const nodeType = String(customData?.['tipo'] ?? '').toUpperCase();

    return nodeType === 'INITIAL';
  }

  private forceInitialNodeVisual(element: dia.Element): void {
    element.attr({
      body: {
        fill: '#111827',
        stroke: '#111827',
        strokeWidth: 2,
      },
      label: {
        text: '',
      },
    });
  }
}
