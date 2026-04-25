import { Injectable, signal } from '@angular/core';

import { DiagramCell, DiagramLane, SocketOperationMessage } from '../interfaces/diagram.models';
import {
  deleteSnapshotCellCascade,
  findSnapshotCell,
  updateSnapshotCellFromMessage,
  updateSnapshotCellPosition,
  upsertCreatedCell,
} from '../utils/editor-snapshot.utils';

@Injectable()
export class DiagramEditorSnapshotStoreService {
  public readonly cells = signal<DiagramCell[]>([]);

  setSnapshot(cells: DiagramCell[]): void {
    this.cells.set(cells);
  }

  clear(): void {
    this.cells.set([]);
  }

  findCell(cellId: string): DiagramCell | undefined {
    return findSnapshotCell(this.cells(), cellId);
  }

  update(updater: (current: DiagramCell[]) => DiagramCell[]): void {
    this.cells.update(updater);
  }

  addCreatedCell(cell: DiagramCell | undefined): void {
    this.cells.update((cells) => upsertCreatedCell(cells, cell));
  }

  updateCellPosition(cellId: string, x: number, y: number): void {
    this.cells.update((cells) => updateSnapshotCellPosition(cells, cellId, x, y));
  }

  applyMessageUpdate(msg: SocketOperationMessage): void {
    this.cells.update((cells) => updateSnapshotCellFromMessage(cells, msg));
  }

  applyMoveMessage(msg: SocketOperationMessage): void {
    this.cells.update((cells) =>
      cells.map((cell) => {
        if (cell.id !== msg.cellId) return cell;
        if (cell.type === 'standard.Link') return cell;

        const nextLaneId =
          msg.opType === 'MOVE_COMMIT'
            ? ((msg.delta['laneId'] as string | undefined) ?? cell.customData?.laneId)
            : cell.customData?.laneId;

        return {
          ...cell,
          position: {
            x: msg.delta['x'],
            y: msg.delta['y'],
          },
          customData: {
            ...(cell.customData ?? {}),
            ...(nextLaneId ? { laneId: nextLaneId } : {}),
          },
        };
      }),
    );
  }

  moveNodesByLaneOffsets(
    offsetsByLaneId: Record<string, number>,
  ): { cellId: string; x: number; y: number }[] {
    const moved: { cellId: string; x: number; y: number }[] = [];

    this.cells.update((cells) =>
      cells.map((cell) => {
        if (cell.type === 'standard.Link') return cell;
        if (!cell.position) return cell;

        const laneId = cell.customData?.laneId;
        if (!laneId) return cell;

        const deltaX = offsetsByLaneId[laneId] ?? 0;
        if (!deltaX) return cell;

        const next = {
          ...cell,
          position: {
            x: cell.position.x + deltaX,
            y: cell.position.y,
          },
        };

        moved.push({
          cellId: cell.id,
          x: next.position.x,
          y: next.position.y,
        });

        return next;
      }),
    );

    return moved;
  }

  clampNodesIntoLanes(
    lanes: DiagramLane[],
    laneHeaderHeightPx: number,
    horizontalPadding = 24,
    verticalPadding = 24,
  ): { cellId: string; x: number; y: number }[] {
    const moved: { cellId: string; x: number; y: number }[] = [];
    const laneById = new Map(lanes.map((lane) => [lane.id, lane]));

    this.cells.update((cells) =>
      cells.map((cell) => {
        if (cell.type === 'standard.Link') return cell;
        if (!cell.position) return cell;

        const laneId = cell.customData?.laneId;
        if (!laneId) return cell;

        const lane = laneById.get(laneId);
        if (!lane) return cell;

        const width = Number(cell.size?.width ?? 160);
        const height = Number(cell.size?.height ?? 60);

        const minX = lane.x + horizontalPadding;
        const maxX = Math.max(minX, lane.x + lane.width - width - horizontalPadding);

        const minY = lane.y + laneHeaderHeightPx + verticalPadding;
        const maxY = Math.max(minY, lane.y + lane.height - height - verticalPadding);

        const nextX = Math.min(Math.max(cell.position.x, minX), maxX);
        const nextY = Math.min(Math.max(cell.position.y, minY), maxY);

        if (nextX === cell.position.x && nextY === cell.position.y) {
          return cell;
        }

        const next = {
          ...cell,
          position: {
            x: nextX,
            y: nextY,
          },
        };

        moved.push({
          cellId: cell.id,
          x: next.position.x,
          y: next.position.y,
        });

        return next;
      }),
    );

    return moved;
  }

  getLaneNodeBottoms(): Record<string, number> {
    const result: Record<string, number> = {};

    for (const cell of this.cells()) {
      if (cell.type === 'standard.Link') continue;
      if (!cell.position) continue;

      const laneId = cell.customData?.laneId;
      if (!laneId) continue;

      const height = Number(cell.size?.height ?? 60);
      const bottom = cell.position.y + height;

      result[laneId] = Math.max(result[laneId] ?? 0, bottom);
    }

    return result;
  }

  deleteCellCascade(cellId: string): void {
    this.cells.update((cells) => deleteSnapshotCellCascade(cells, cellId));
  }
}
