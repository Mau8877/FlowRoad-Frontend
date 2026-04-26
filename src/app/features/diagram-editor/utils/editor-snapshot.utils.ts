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

    const hasKey = (key: string) => Object.prototype.hasOwnProperty.call(msg.delta, key);
    const nextCustomData = hasKey('customData')
      ? {
          ...(cell.customData ?? {}),
          ...(msg.delta['customData'] ?? {}),
        }
      : cell.customData;

    return {
      ...cell,
      ...(hasKey('position') ? { position: msg.delta['position'] } : {}),
      ...(hasKey('size') ? { size: msg.delta['size'] } : {}),
      ...(hasKey('source') ? { source: msg.delta['source'] } : {}),
      ...(hasKey('target') ? { target: msg.delta['target'] } : {}),
      ...(hasKey('vertices') ? { vertices: msg.delta['vertices'] } : {}),
      ...(hasKey('labels') ? { labels: msg.delta['labels'] } : {}),
      ...(hasKey('attrs') ? { attrs: msg.delta['attrs'] } : {}),
      ...(hasKey('router') ? { router: msg.delta['router'] } : {}),
      ...(hasKey('connector') ? { connector: msg.delta['connector'] } : {}),
      ...(hasKey('customData') ? { customData: nextCustomData } : {}),
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
