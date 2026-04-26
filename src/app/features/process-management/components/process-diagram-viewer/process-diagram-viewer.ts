import { CommonModule } from '@angular/common';
import {
  AfterViewChecked,
  Component,
  ElementRef,
  Input,
  OnChanges,
  OnDestroy,
  SimpleChanges,
  ViewChild,
  signal,
} from '@angular/core';
import { dia, shapes } from '@joint/core';

import { Diagram } from '#/app/features/diagram-editor/interfaces/diagram.models';

type CellStatus = 'COMPLETED' | 'ACTIVE' | 'PENDING';

interface RuntimeLane {
  id: string;
  departmentId?: string;
  departmentName?: string;
  order?: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

interface LaneOverlay {
  id: string;
  name: string;
  left: number;
  top: number;
  width: number;
  height: number;
}

@Component({
  selector: 'app-process-diagram-viewer',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './process-diagram-viewer.html',
})
export class ProcessDiagramViewer implements AfterViewChecked, OnChanges, OnDestroy {
  @ViewChild('paperContainer')
  private paperContainer?: ElementRef<HTMLDivElement>;

  @Input() diagram: Diagram | null | undefined = null;
  @Input() completedNodeIds: string[] = [];
  @Input() activeNodeIds: string[] = [];

  public renderError = signal<string | null>(null);
  public cellsCount = signal(0);
  public lanesCount = signal(0);
  public laneOverlays = signal<LaneOverlay[]>([]);

  private graph?: dia.Graph;
  private paper?: dia.Paper;

  private initialized = false;
  private pendingRender = false;

  ngAfterViewChecked(): void {
    if (!this.initialized && this.paperContainer?.nativeElement) {
      this.initializePaper();
      this.initialized = true;
      this.pendingRender = true;
    }

    if (this.pendingRender && this.paper && this.graph) {
      this.pendingRender = false;
      this.renderDiagram();
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['diagram'] || changes['completedNodeIds'] || changes['activeNodeIds']) {
      this.pendingRender = true;
    }
  }

  ngOnDestroy(): void {
    this.paper?.remove();
    this.graph?.clear();
  }

  private initializePaper(): void {
    const container = this.paperContainer?.nativeElement;

    if (!container || this.paper) {
      return;
    }

    this.graph = new dia.Graph({}, { cellNamespace: shapes });

    this.paper = new dia.Paper({
      el: container,
      model: this.graph,
      width: container.clientWidth || 1200,
      height: 760,
      gridSize: 10,
      drawGrid: false,
      cellViewNamespace: shapes,
      interactive: false,
      async: false,
      frozen: false,
      sorting: dia.Paper.sorting.APPROX,
    });
  }

  private renderDiagram(): void {
    if (!this.paper || !this.graph) {
      return;
    }

    this.renderError.set(null);
    this.laneOverlays.set([]);

    const cells = this.resolveDiagramCells();
    const lanes = this.resolveDiagramLanes();

    this.cellsCount.set(cells.length);
    this.lanesCount.set(lanes.length);

    this.graph.clear();

    if (cells.length === 0) {
      this.renderError.set('El diagrama llegó sin celdas para renderizar.');
      return;
    }

    try {
      const clonedCells = this.cloneCells(cells).map((cell: any) => ({
        ...cell,
        z: cell.type === 'standard.Link' ? 10 : 20,
      }));

      this.graph.fromJSON({ cells: clonedCells });

      this.prepareCircleNodes();
      this.applyReadOnlyStyle();
      this.applyProgressStyles();
      this.applySmartRoutingToLinks();
      this.restoreZOrder();

      requestAnimationFrame(() => {
        this.fitDiagramToContainer(lanes);
        this.prepareCircleNodes();
        this.applySmartRoutingToLinks();
        this.restoreZOrder();
        this.updateLaneOverlays(lanes);
      });
    } catch (error) {
      console.error('[PROCESS-DIAGRAM-VIEWER][RENDER_ERROR]', error);
      this.graph.clear();
      this.renderError.set('No se pudo renderizar el diagrama con JointJS.');
    }
  }

  private resolveDiagramCells(): unknown[] {
    const diagramAsAny = this.diagram as any;

    if (!diagramAsAny) {
      return [];
    }

    if (Array.isArray(diagramAsAny.cells)) {
      return diagramAsAny.cells;
    }

    if (Array.isArray(diagramAsAny.diagram?.cells)) {
      return diagramAsAny.diagram.cells;
    }

    if (Array.isArray(diagramAsAny.snapshot?.cells)) {
      return diagramAsAny.snapshot.cells;
    }

    if (Array.isArray(diagramAsAny.snapshot?.diagram?.cells)) {
      return diagramAsAny.snapshot.diagram.cells;
    }

    if (typeof diagramAsAny.snapshot === 'string') {
      try {
        const parsedSnapshot = JSON.parse(diagramAsAny.snapshot);

        if (Array.isArray(parsedSnapshot.cells)) {
          return parsedSnapshot.cells;
        }

        if (Array.isArray(parsedSnapshot.diagram?.cells)) {
          return parsedSnapshot.diagram.cells;
        }
      } catch {
        return [];
      }
    }

    return [];
  }

  private resolveDiagramLanes(): RuntimeLane[] {
    const diagramAsAny = this.diagram as any;

    if (!diagramAsAny) {
      return [];
    }

    if (Array.isArray(diagramAsAny.lanes)) {
      return diagramAsAny.lanes;
    }

    if (Array.isArray(diagramAsAny.diagram?.lanes)) {
      return diagramAsAny.diagram.lanes;
    }

    if (Array.isArray(diagramAsAny.snapshot?.lanes)) {
      return diagramAsAny.snapshot.lanes;
    }

    if (Array.isArray(diagramAsAny.snapshot?.diagram?.lanes)) {
      return diagramAsAny.snapshot.diagram.lanes;
    }

    if (typeof diagramAsAny.snapshot === 'string') {
      try {
        const parsedSnapshot = JSON.parse(diagramAsAny.snapshot);

        if (Array.isArray(parsedSnapshot.lanes)) {
          return parsedSnapshot.lanes;
        }

        if (Array.isArray(parsedSnapshot.diagram?.lanes)) {
          return parsedSnapshot.diagram.lanes;
        }
      } catch {
        return [];
      }
    }

    return [];
  }

  private cloneCells(cells: unknown[]): any[] {
    return JSON.parse(JSON.stringify(cells)) as any[];
  }

  private prepareCircleNodes(): void {
    if (!this.graph) {
      return;
    }

    this.graph.getElements().forEach((element: dia.Element) => {
      if (!this.isCircleNode(element)) {
        return;
      }

      this.applyCircleMarkup(element);
    });
  }

  /**
   * IMPORTANTE:
   * Tu nodo FINAL ya viene del backend con selector "inner".
   * Por eso usamos "inner", no "innerDot".
   */
  private applyCircleMarkup(element: dia.Element): void {
    element.set(
      'markup',
      [
        {
          tagName: 'circle',
          selector: 'body',
        },
        {
          tagName: 'circle',
          selector: 'inner',
        },
        {
          tagName: 'text',
          selector: 'label',
        },
      ],
      { silent: true },
    );

    const isFinal = this.isFinalNode(element);

    element.attr({
      body: {
        refCx: '50%',
        refCy: '50%',
        refR: '50%',
      },
      inner: {
        refCx: '50%',
        refCy: '50%',
        refR: '28%',
        display: isFinal ? 'block' : 'none',
      },
      label: {
        refX: '50%',
        refY: '50%',
        textAnchor: 'middle',
        textVerticalAnchor: 'middle',
      },
    });
  }

  private applyReadOnlyStyle(): void {
    if (!this.graph) {
      return;
    }

    this.graph.getCells().forEach((cell: dia.Cell) => {
      if (cell.isLink()) {
        const link = cell as dia.Link;

        link.attr({
          line: {
            stroke: '#94a3b8',
            strokeWidth: 2,
            targetMarker: {
              type: 'path',
              d: 'M 10 -5 0 0 10 5 z',
              fill: '#94a3b8',
              stroke: '#94a3b8',
            },
          },
        });

        return;
      }

      const element = cell as dia.Element;

      if (this.isCircleNode(element)) {
        this.applyCircleMarkup(element);
      }

      element.attr({
        body: {
          stroke: '#cbd5e1',
          strokeWidth: 2,
          fill: '#ffffff',
        },
        inner: {
          display: this.isFinalNode(element) ? 'block' : 'none',
          stroke: '#cbd5e1',
          fill: '#cbd5e1',
          strokeWidth: 1,
        },
        label: {
          fill: '#0f172a',
          fontWeight: 700,
        },
      });
    });
  }

  private applyProgressStyles(): void {
    if (!this.graph) {
      return;
    }

    const completed = new Set(this.completedNodeIds ?? []);
    const active = new Set(this.activeNodeIds ?? []);

    this.graph.getElements().forEach((element: dia.Element) => {
      const status = this.resolveCellStatus(String(element.id), completed, active);

      if (status === 'COMPLETED') {
        this.paintCompletedNode(element);
        return;
      }

      if (status === 'ACTIVE') {
        this.paintActiveNode(element);
        return;
      }

      this.paintPendingNode(element);
    });

    this.graph.getLinks().forEach((link: dia.Link) => {
      const source = link.get('source') as { id?: string } | undefined;
      const target = link.get('target') as { id?: string } | undefined;

      const sourceId = source?.id;
      const targetId = target?.id;

      const sourceCompleted = sourceId ? completed.has(sourceId) : false;
      const targetCompleted = targetId ? completed.has(targetId) : false;
      const targetActive = targetId ? active.has(targetId) : false;

      if (sourceCompleted && (targetCompleted || targetActive)) {
        this.paintTraversedLink(link);
      } else {
        this.paintPendingLink(link);
      }
    });
  }

  private applySmartRoutingToLinks(): void {
    if (!this.graph) {
      return;
    }

    this.graph.getLinks().forEach((link: dia.Link) => {
      const currentVertices = link.vertices() ?? [];
      const hasVertices = currentVertices.length > 0;

      link.set(
        'connector',
        {
          name: 'rounded',
          args: {
            radius: 10,
          },
        },
        { silent: true },
      );

      if (hasVertices) {
        link.set(
          'router',
          {
            name: 'normal',
          },
          { silent: true },
        );
      } else {
        link.set(
          'router',
          {
            name: 'manhattan',
            args: {
              step: 20,
              padding: 24,
              maximumLoops: 200,
              startDirections: ['top', 'right', 'bottom', 'left'],
              endDirections: ['top', 'right', 'bottom', 'left'],
            },
          },
          { silent: true },
        );
      }

      const source = { ...(link.get('source') ?? {}) };
      const target = { ...(link.get('target') ?? {}) };

      source.anchor = source.anchor ?? { name: 'center' };
      target.anchor = target.anchor ?? { name: 'center' };

      link.set(
        'source',
        {
          ...source,
          connectionPoint: {
            name: 'boundary',
            args: {
              offset: 4,
            },
          },
        },
        { silent: true },
      );

      link.set(
        'target',
        {
          ...target,
          connectionPoint: {
            name: 'boundary',
            args: {
              offset: 4,
            },
          },
        },
        { silent: true },
      );
    });
  }

  private resolveCellStatus(
    cellId: string,
    completed: Set<string>,
    active: Set<string>,
  ): CellStatus {
    if (active.has(cellId)) {
      return 'ACTIVE';
    }

    if (completed.has(cellId)) {
      return 'COMPLETED';
    }

    return 'PENDING';
  }

  private paintCompletedNode(element: dia.Element): void {
    if (this.isCircleNode(element)) {
      this.applyCircleMarkup(element);
    }

    const isFinal = this.isFinalNode(element);

    element.attr({
      body: {
        fill: '#ecfdf5',
        stroke: '#10b981',
        strokeWidth: 3,
      },
      inner: {
        display: isFinal ? 'block' : 'none',
        fill: '#10b981',
        stroke: '#10b981',
        strokeWidth: 1,
      },
      label: {
        fill: '#065f46',
        fontWeight: 800,
      },
    });
  }

  private paintActiveNode(element: dia.Element): void {
    if (this.isCircleNode(element)) {
      this.applyCircleMarkup(element);
    }

    const isFinal = this.isFinalNode(element);

    element.attr({
      body: {
        fill: '#fffbeb',
        stroke: '#cc9e61',
        strokeWidth: 4,
      },
      inner: {
        display: isFinal ? 'block' : 'none',
        fill: '#cc9e61',
        stroke: '#cc9e61',
        strokeWidth: 1,
      },
      label: {
        fill: '#541f14',
        fontWeight: 900,
      },
    });
  }

  private paintPendingNode(element: dia.Element): void {
    if (this.isCircleNode(element)) {
      this.applyCircleMarkup(element);
    }

    const isFinal = this.isFinalNode(element);

    element.attr({
      body: {
        fill: '#ffffff',
        stroke: '#cbd5e1',
        strokeWidth: 2,
      },
      inner: {
        display: isFinal ? 'block' : 'none',
        fill: '#cbd5e1',
        stroke: '#cbd5e1',
        strokeWidth: 1,
      },
      label: {
        fill: '#475569',
        fontWeight: 700,
      },
    });
  }

  private paintTraversedLink(link: dia.Link): void {
    link.attr({
      line: {
        stroke: '#10b981',
        strokeWidth: 3,
        targetMarker: {
          type: 'path',
          d: 'M 10 -5 0 0 10 5 z',
          fill: '#10b981',
          stroke: '#10b981',
        },
      },
    });
  }

  private paintPendingLink(link: dia.Link): void {
    link.attr({
      line: {
        stroke: '#cbd5e1',
        strokeWidth: 2,
        targetMarker: {
          type: 'path',
          d: 'M 10 -5 0 0 10 5 z',
          fill: '#cbd5e1',
          stroke: '#cbd5e1',
        },
      },
    });
  }

  private restoreZOrder(): void {
    if (!this.graph) {
      return;
    }

    this.graph.getLinks().forEach((link: dia.Link) => {
      link.toBack();
    });

    this.graph.getElements().forEach((element: dia.Element) => {
      element.toFront();
    });
  }

  private fitDiagramToContainer(lanes: RuntimeLane[]): void {
    if (!this.paper || !this.graph || this.graph.getCells().length === 0) {
      return;
    }

    const container = this.paperContainer?.nativeElement;

    if (container) {
      this.paper.setDimensions(container.clientWidth || 1200, 760);
    }

    const topPadding = lanes.length > 0 ? 92 : 40;

    this.paper.scaleContentToFit({
      padding: {
        top: topPadding,
        right: 50,
        bottom: 50,
        left: 50,
      },
      minScale: 0.2,
      maxScale: 1,
      preserveAspectRatio: true,
    });
  }

  private updateLaneOverlays(lanes: RuntimeLane[]): void {
    if (!this.paper || lanes.length === 0) {
      this.laneOverlays.set([]);
      return;
    }

    const scale = this.paper.scale();
    const translation = this.paper.translate();

    const overlays = [...lanes]
      .sort((a, b) => {
        const orderA = a.order ?? 0;
        const orderB = b.order ?? 0;

        if (orderA !== orderB) {
          return orderA - orderB;
        }

        return a.x - b.x;
      })
      .map((lane) => ({
        id: lane.id,
        name: lane.departmentName?.trim() || 'Sin lane',
        left: lane.x * scale.sx + translation.tx,
        top: lane.y * scale.sy + translation.ty,
        width: lane.width * scale.sx,
        height: lane.height * scale.sy,
      }));

    this.laneOverlays.set(overlays);
  }

  private isCircleNode(element: dia.Element): boolean {
    return element.get('type') === 'standard.Circle';
  }

  private isFinalNode(element: dia.Element): boolean {
    if (!this.graph || !this.isCircleNode(element)) {
      return false;
    }

    const customData = element.get('customData') as { tipo?: string; nombre?: string } | undefined;

    const tipo = this.normalizeText(customData?.tipo);
    const nombre = this.normalizeText(customData?.nombre);

    if (tipo === 'FINAL' || tipo === 'FIN' || nombre === 'FIN' || nombre === 'FINAL') {
      return true;
    }

    const connectedLinks = this.graph.getConnectedLinks(element);

    const incomingLinks = connectedLinks.filter((link) => {
      const target = link.get('target') as { id?: string } | undefined;
      return target?.id === element.id;
    });

    const outgoingLinks = connectedLinks.filter((link) => {
      const source = link.get('source') as { id?: string } | undefined;
      return source?.id === element.id;
    });

    return incomingLinks.length > 0 && outgoingLinks.length === 0;
  }

  private normalizeText(value?: string | null): string {
    return (value ?? '')
      .trim()
      .toUpperCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
  }
}
