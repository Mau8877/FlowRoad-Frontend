import { Injectable, signal } from '@angular/core';

import { DiagramCell, SocketOperationMessage } from '../interfaces/diagram.models';
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
            ? (msg.delta['laneId'] as string | undefined) ?? cell.customData?.laneId
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

  deleteCellCascade(cellId: string): void {
    this.cells.update((cells) => deleteSnapshotCellCascade(cells, cellId));
  }
}