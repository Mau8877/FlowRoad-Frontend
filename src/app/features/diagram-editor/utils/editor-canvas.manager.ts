import { dia, shapes } from '@joint/core';
import { DiagramCell } from '../interfaces/diagram.models';

export interface CanvasManagerCallbacks {
  onCellSelected(cellId: string, label: string): void;
  onBlankPointerDown(x: number, y: number): void;
  onElementPointerDown(cellId: string, position: { x: number; y: number }): void;
  onElementPositionChanged(cellId: string, x: number, y: number): void;
  onElementPointerUp(cellId: string, x: number, y: number): void;
  isCellRemotelyLocked(cellId: string): boolean;
  getActiveDraggingCellId(): string | null;
  isDragTransitionLocked(): boolean;
  isPanMode(): boolean;
}

export class EditorCanvasManager {
  private graph!: dia.Graph;
  private paper!: dia.Paper;
  private resizeObserver?: ResizeObserver;
  private resizeFrame: number | null = null;

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
      background: {
        color: 'transparent',
      },
      interactive: (cellView) => {
        const cellId = String(cellView.model.id);

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
          return activeDraggingCellId === cellId;
        }

        return true;
      },
    });

    this.registerEvents();
    this.observeResize();
    this.scheduleResize();
  }

  destroy(): void {
    this.resizeObserver?.disconnect();

    if (this.resizeFrame !== null) {
      cancelAnimationFrame(this.resizeFrame);
      this.resizeFrame = null;
    }

    this.paper?.remove();
  }

  clearAndRender(cells: DiagramCell[]): void {
    this.graph.clear();

    for (const cell of cells) {
      const jointCell = this.buildJointCell(cell);
      if (jointCell) {
        this.graph.addCell(jointCell);
      }
    }

    this.scheduleResize();
  }

  addCell(cell: DiagramCell): void {
    if (this.graph.getCell(cell.id)) return;

    const jointCell = this.buildJointCell(cell);
    if (jointCell) {
      this.graph.addCell(jointCell);
    }
  }

  applyMove(cellId: string, x: number, y: number): void {
    const cell = this.graph.getCell(cellId);

    if (cell && !cell.isLink()) {
      const element = cell as dia.Element;
      element.position(x, y);
    }
  }

  applyUpdate(cellId: string, delta: Record<string, any>): void {
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

    if (delta['customData']) {
      jointCell.set('customData', delta['customData']);
    }
  }

  applyDelete(cellId: string): void {
    const targetCell = this.graph.getCell(cellId);
    if (!targetCell) return;

    if (targetCell.isLink()) {
      targetCell.remove();
      return;
    }

    const connectedLinks = this.graph.getConnectedLinks(targetCell);
    connectedLinks.forEach((link) => link.remove());
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

    const stroke = snapshotCell.attrs?.['body']?.['stroke'] || '#2563eb';
    const strokeWidth = snapshotCell.attrs?.['body']?.['strokeWidth'] || 2;

    cell.attr('body/stroke', stroke);
    cell.attr('body/strokeWidth', strokeWidth);
  }

  private registerEvents(): void {
    this.paper.on('cell:pointerclick', (cellView) => {
      const cellId = String(cellView.model.id);
      const label = cellView.model.attr('label/text') || '';
      this.callbacks.onCellSelected(cellId, String(label));
    });

    this.paper.on('blank:pointerdown', (_evt, x, y) => {
      this.callbacks.onBlankPointerDown(x, y);
    });

    this.paper.on('element:pointerdown', (elementView) => {
      const cellId = String(elementView.model.id);
      const element = elementView.model as dia.Element;
      const position = element.position();

      this.callbacks.onElementPointerDown(cellId, {
        x: position.x,
        y: position.y,
      });
    });

    this.graph.on('change:position', (cell) => {
      if (cell.isLink()) return;

      const element = cell as dia.Element;
      const position = element.position();

      this.callbacks.onElementPositionChanged(String(element.id), position.x, position.y);
    });

    this.paper.on('element:pointerup', (elementView) => {
      const cellId = String(elementView.model.id);
      const element = elementView.model as dia.Element;
      const position = element.position();

      this.callbacks.onElementPointerUp(cellId, position.x, position.y);
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

  private buildJointCell(cell: DiagramCell): dia.Cell | null {
    if (cell.type === 'standard.Link') {
      const link = new shapes.standard.Link({
        id: cell.id,
        source: cell.source || {},
        target: cell.target || {},
        attrs: cell.attrs || {
          line: {
            stroke: '#334155',
            strokeWidth: 2,
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