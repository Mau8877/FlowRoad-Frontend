import { Injectable, inject } from '@angular/core';
import { DiagramCell, DiagramLane } from '../interfaces/diagram.models';
import { findSnapshotCell } from '../utils/editor-snapshot.utils';
import { DiagramEditorUiService } from './diagram-editor-ui.service';

@Injectable()
export class DiagramEditorLaneService {
  private readonly uiService = inject(DiagramEditorUiService);

  private readonly defaultNodeWidth = 160;
  private readonly defaultNodeHeight = 60;
  private readonly laneHorizontalPadding = 24;
  private readonly laneVerticalPadding = 24;

  getOrderedLanes(): DiagramLane[] {
    return [...this.uiService.lanes()].sort((a, b) => a.order - b.order);
  }

  resolveLaneForX(x: number): DiagramLane | null {
    const lanes = this.getOrderedLanes();
    if (lanes.length === 0) return null;

    const laneWidth = this.uiService.laneWidthPx;
    const laneIndex = Math.floor(Math.max(0, x) / laneWidth);
    const safeIndex = Math.min(laneIndex, lanes.length - 1);

    return lanes[safeIndex] ?? null;
  }

  normalizeNodePositionToLane(
    x: number,
    y: number,
    lane: DiagramLane,
    nodeWidth = this.defaultNodeWidth,
    nodeHeight = this.defaultNodeHeight,
  ): { x: number; y: number } {
    const lanes = this.getOrderedLanes();
    const laneIndex = lanes.findIndex((item) => item.id === lane.id);
    const safeLaneIndex = Math.max(0, laneIndex);

    const laneLeft = safeLaneIndex * this.uiService.laneWidthPx;
    const laneRight = laneLeft + this.uiService.laneWidthPx;

    const minX = laneLeft + this.laneHorizontalPadding;
    const maxX = laneRight - nodeWidth - this.laneHorizontalPadding;

    const minY = this.uiService.laneHeaderHeightPx + this.laneVerticalPadding;
    const maxY = Math.max(
      minY,
      this.uiService.canvasHeightPx() - nodeHeight - this.laneVerticalPadding,
    );

    return {
      x: Math.min(Math.max(x, minX), Math.max(minX, maxX)),
      y: Math.min(Math.max(y, minY), maxY),
    };
  }

  getDefaultCreatePosition(): { x: number; y: number } | null {
    const lanes = this.getOrderedLanes();
    if (lanes.length === 0) return null;

    return {
      x: this.laneHorizontalPadding,
      y: this.uiService.laneHeaderHeightPx + this.laneVerticalPadding,
    };
  }

  getCellLaneId(cells: DiagramCell[], cellId: string): string | null {
    const cell = findSnapshotCell(cells, cellId);
    if (!cell || cell.type === 'standard.Link') return null;
    return cell.customData?.laneId ?? null;
  }
}