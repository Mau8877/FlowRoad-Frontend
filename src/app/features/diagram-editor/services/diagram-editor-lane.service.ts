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

  resolveLaneForPoint(x: number, y: number): DiagramLane | null {
    const lanes = this.getOrderedLanes();

    for (const lane of lanes) {
      const insideX = x >= lane.x && x <= lane.x + lane.width;
      const insideY = y >= lane.y && y <= lane.y + lane.height;

      if (insideX && insideY) {
        return lane;
      }
    }

    return null;
  }

  resolveLaneForX(x: number): DiagramLane | null {
    const lanes = this.getOrderedLanes();

    for (const lane of lanes) {
      const insideX = x >= lane.x && x <= lane.x + lane.width;
      if (insideX) {
        return lane;
      }
    }

    return null;
  }

  normalizeNodePositionToLane(
    x: number,
    y: number,
    lane: DiagramLane,
    nodeWidth = this.defaultNodeWidth,
    nodeHeight = this.defaultNodeHeight,
  ): { x: number; y: number } {
    const minX = lane.x + this.laneHorizontalPadding;
    const maxX = lane.x + lane.width - nodeWidth - this.laneHorizontalPadding;

    const minY = lane.y + this.uiService.laneHeaderHeightPx + this.laneVerticalPadding;
    const maxY = lane.y + lane.height - nodeHeight - this.laneVerticalPadding;

    return {
      x: Math.min(Math.max(x, minX), Math.max(minX, maxX)),
      y: Math.min(Math.max(y, minY), Math.max(minY, maxY)),
    };
  }

  getDefaultCreatePosition(): { x: number; y: number } | null {
    const lanes = this.getOrderedLanes();
    if (lanes.length === 0) return null;

    const firstLane = lanes[0];

    return {
      x: firstLane.x + this.laneHorizontalPadding,
      y: firstLane.y + this.uiService.laneHeaderHeightPx + this.laneVerticalPadding,
    };
  }

  getCellLaneId(cells: DiagramCell[], cellId: string): string | null {
    const cell = findSnapshotCell(cells, cellId);
    if (!cell || cell.type === 'standard.Link') return null;
    return cell.customData?.laneId ?? null;
  }
}
