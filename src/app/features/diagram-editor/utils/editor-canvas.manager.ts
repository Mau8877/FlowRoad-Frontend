import { dia, shapes } from '@joint/core';
import { DiagramCell } from '../interfaces/diagram.models';

export interface CanvasManagerCallbacks {
  onCellSelected(cellId: string, label: string): void;
  onCellDoubleClicked(cellId: string, label: string): void;
  onBlankPointerDown(x: number, y: number): void;
  onElementPointerDown(cellId: string, position: { x: number; y: number }): void;
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

type HighlightMode = 'selected-node' | 'selected-link' | 'link-source' | 'link-target';

export class EditorCanvasManager {
  private graph!: dia.Graph;
  private paper!: dia.Paper;
  private resizeObserver?: ResizeObserver;
  private resizeFrame: number | null = null;

  private pendingPointerState: PendingPointerState | null = null;
  private selectedCellId: string | null = null;
  private linkSourceCellId: string | null = null;
  private linkTargetCellId: string | null = null;

  private readonly previewLinkId = '__draft-link-preview__';

  private readonly handleHostPointerMove = (event: PointerEvent): void => {
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

    this.pendingPointerState = null;
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
    }
  }

  applyUpdate(cellId: string, delta: Record<string, any>): void {
    if (cellId === this.previewLinkId) return;

    const jointCell = this.graph.getCell(cellId);
    if (!jointCell) return;

    if (delta['position'] && !jointCell.isLink()) {
      const element = jointCell as dia.Element;
      element.position(delta['position'].x, delta['position'].y);
    }

    if (delta['size'] && !jointCell.isLink()) {
      const element = jointCell as dia.Element;
      element.resize(delta['size'].width, delta['size'].height);
    }

    if (delta['attrs']) {
      jointCell.attr(delta['attrs']);
    }

    if (delta['source'] && jointCell.isLink()) {
      jointCell.set('source', delta['source']);
    }

    if (delta['target'] && jointCell.isLink()) {
      jointCell.set('target', delta['target']);
    }

    if (delta['vertices'] && jointCell.isLink()) {
      jointCell.set('vertices', delta['vertices']);
    }

    if (delta['router'] && jointCell.isLink()) {
      jointCell.set('router', delta['router']);
    }

    if (delta['connector'] && jointCell.isLink()) {
      jointCell.set('connector', delta['connector']);
    }

    if (delta['customData']) {
      jointCell.set('customData', delta['customData']);
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
  }

  clearSelection(snapshotCell?: DiagramCell, explicitCellId?: string): void {
    const cellId = explicitCellId ?? this.selectedCellId;
    if (!cellId) return;

    this.restoreCellVisual(cellId, snapshotCell);

    if (!explicitCellId || explicitCellId === this.selectedCellId) {
      this.selectedCellId = null;
    }
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

    this.paper.on('element:pointerdown', (elementView) => {
      const cellId = String(elementView.model.id);

      if (cellId === this.previewLinkId) {
        return;
      }

      const element = elementView.model as dia.Element;
      const position = element.position();

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
      const polygon = new shapes.standard.Polygon({
        id: cell.id,
        position: cell.position || { x: 100, y: 100 },
        size: cell.size || { width: 90, height: 90 },
        attrs: cell.attrs || {
          body: {
            refPoints: '50,0 100,50 50,100 0,50',
            fill: '#ffffff',
            stroke: '#2563eb',
            strokeWidth: 2,
          },
          label: {
            text: 'Decisión',
            fill: '#111827',
          },
        },
      });

      polygon.set('customData', cell.customData || {});
      return polygon;
    }

    const rect = new shapes.standard.Rectangle({
      id: cell.id,
      position: cell.position || { x: 100, y: 100 },
      size: cell.size || { width: 160, height: 60 },
      attrs: cell.attrs || {
        body: {
          fill: '#ffffff',
          stroke: '#2563eb',
          strokeWidth: 2,
          rx: 12,
          ry: 12,
        },
        label: {
          text: 'Nueva Actividad',
          fill: '#111827',
        },
      },
    });

    rect.set('customData', cell.customData || {});
    return rect;
  }
}
