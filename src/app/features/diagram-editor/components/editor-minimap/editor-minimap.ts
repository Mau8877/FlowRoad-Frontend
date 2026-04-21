import { CommonModule } from '@angular/common';
import { Component, Input, OnChanges } from '@angular/core';
import { DiagramCell } from '../../interfaces/diagram.models';

interface MinimapNode {
  id: string;
  left: number;
  top: number;
  width: number;
  height: number;
}

interface MinimapLink {
  id: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

@Component({
  selector: 'app-editor-minimap',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './editor-minimap.html',
  styleUrl: './editor-minimap.css',
})
export class EditorMinimapComponent implements OnChanges {
  @Input() cells: DiagramCell[] = [];
  @Input() title = 'Mapa';

  private readonly minimapWidth = 220;
  private readonly minimapHeight = 140;
  private readonly padding = 12;

  public hasContent = false;
  public minimapNodes: MinimapNode[] = [];
  public minimapLinks: MinimapLink[] = [];

  ngOnChanges(): void {
    this.rebuildMinimap();
  }

  private rebuildMinimap(): void {
    const nodes = this.cells.filter((cell) => cell.type !== 'standard.Link');
    const links = this.cells.filter((cell) => cell.type === 'standard.Link');

    this.hasContent = nodes.length > 0;

    if (nodes.length === 0) {
      this.minimapNodes = [];
      this.minimapLinks = [];
      return;
    }

    let minX = Number.POSITIVE_INFINITY;
    let minY = Number.POSITIVE_INFINITY;
    let maxX = Number.NEGATIVE_INFINITY;
    let maxY = Number.NEGATIVE_INFINITY;

    for (const node of nodes) {
      const x = node.position?.x ?? 0;
      const y = node.position?.y ?? 0;
      const width = node.size?.width ?? 160;
      const height = node.size?.height ?? 60;

      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x + width);
      maxY = Math.max(maxY, y + height);
    }

    const contentWidth = Math.max(1, maxX - minX);
    const contentHeight = Math.max(1, maxY - minY);

    const scaleX = (this.minimapWidth - this.padding * 2) / contentWidth;
    const scaleY = (this.minimapHeight - this.padding * 2) / contentHeight;
    const scale = Math.min(scaleX, scaleY);

    this.minimapNodes = nodes.map((node) => {
      const x = node.position?.x ?? 0;
      const y = node.position?.y ?? 0;
      const width = node.size?.width ?? 160;
      const height = node.size?.height ?? 60;

      return {
        id: node.id,
        left: this.padding + (x - minX) * scale,
        top: this.padding + (y - minY) * scale,
        width: Math.max(10, width * scale),
        height: Math.max(8, height * scale),
      };
    });

    this.minimapLinks = links
      .map((link) => {
        const sourceNode = nodes.find((node) => node.id === link.source?.id);
        const targetNode = nodes.find((node) => node.id === link.target?.id);

        if (!sourceNode || !targetNode) return null;

        const sourceX = (sourceNode.position?.x ?? 0) + (sourceNode.size?.width ?? 160) / 2;
        const sourceY = (sourceNode.position?.y ?? 0) + (sourceNode.size?.height ?? 60) / 2;
        const targetX = (targetNode.position?.x ?? 0) + (targetNode.size?.width ?? 160) / 2;
        const targetY = (targetNode.position?.y ?? 0) + (targetNode.size?.height ?? 60) / 2;

        return {
          id: link.id,
          x1: this.padding + (sourceX - minX) * scale,
          y1: this.padding + (sourceY - minY) * scale,
          x2: this.padding + (targetX - minX) * scale,
          y2: this.padding + (targetY - minY) * scale,
        };
      })
      .filter((item): item is MinimapLink => item !== null);
  }
}
