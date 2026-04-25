import { DiagramCell, SocketOperationMessage } from '../interfaces/diagram.models';

export function upsertCreatedCell(
  cells: DiagramCell[],
  cell: DiagramCell | undefined,
): DiagramCell[] {
  if (!cell) return cells;

  const exists = cells.some((c) => c.id === cell.id);
  if (exists) return cells;

  return [...cells, cell];
}

export function updateSnapshotCellPosition(
  cells: DiagramCell[],
  cellId: string,
  x: number,
  y: number,
): DiagramCell[] {
  return cells.map((cell) =>
    cell.id === cellId
      ? {
          ...cell,
          position: { x, y },
        }
      : cell,
  );
}

export function updateSnapshotCellFromMessage(
  cells: DiagramCell[],
  msg: SocketOperationMessage,
): DiagramCell[] {
  return cells.map((cell) => {
    if (cell.id !== msg.cellId) return cell;

    return {
      ...cell,
      ...(msg.delta['position'] ? { position: msg.delta['position'] } : {}),
      ...(msg.delta['size'] ? { size: msg.delta['size'] } : {}),
      ...(msg.delta['source'] ? { source: msg.delta['source'] } : {}),
      ...(msg.delta['target'] ? { target: msg.delta['target'] } : {}),
      ...(msg.delta['vertices'] ? { vertices: msg.delta['vertices'] } : {}),
      ...(msg.delta['attrs'] ? { attrs: msg.delta['attrs'] } : {}),
      ...(msg.delta['router'] ? { router: msg.delta['router'] } : {}),
      ...(msg.delta['connector'] ? { connector: msg.delta['connector'] } : {}),
      ...(msg.delta['customData'] ? { customData: msg.delta['customData'] } : {}),
    };
  });
}

export function deleteSnapshotCellCascade(cells: DiagramCell[], cellId: string): DiagramCell[] {
  const targetCell = cells.find((c) => c.id === cellId);

  if (!targetCell) return cells;

  const isNode = targetCell.type !== 'standard.Link';

  if (!isNode) {
    return cells.filter((c) => c.id !== cellId);
  }

  return cells.filter((c) => {
    if (c.id === cellId) return false;

    const isRelatedLink =
      c.type === 'standard.Link' && (c.source?.id === cellId || c.target?.id === cellId);

    return !isRelatedLink;
  });
}

export function findSnapshotCell(cells: DiagramCell[], cellId: string): DiagramCell | undefined {
  return cells.find((cell) => cell.id === cellId);
}
