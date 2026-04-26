import { TemplateSummaryResponse } from '#/app/features/config-org/interfaces/plantillas.models';
import { CommonModule } from '@angular/common';
import {
  Component,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DiagramCell } from '../../interfaces/diagram.models';

export interface NodeInspectorSubmitPayload {
  label: string;
  width?: number;
  height?: number;
  templateDocumentId?: string;
}

@Component({
  selector: 'app-editor-node-inspector',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './editor-node-inspector.html',
  styleUrl: './editor-node-inspector.css',
})
export class EditorNodeInspectorComponent implements OnChanges {
  @Input() selectedCell: DiagramCell | null = null;
  @Input() availableTemplates: TemplateSummaryResponse[] = [];
  @Input() isSaving = false;

  @Output() saveRequested = new EventEmitter<NodeInspectorSubmitPayload>();
  @Output() deleteRequested = new EventEmitter<void>();

  public draftLabel = signal('');
  public draftWidth = signal(160);
  public draftHeight = signal(60);
  public draftTemplateDocumentId = signal('');

  public isLinkSelected(): boolean {
    return this.selectedCell?.type === 'standard.Link';
  }

  public isNodeSelected(): boolean {
    return !!this.selectedCell && this.selectedCell.type !== 'standard.Link';
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['selectedCell']) {
      this.syncFromSelectedCell();
    }
  }

  onSave(): void {
    if (!this.selectedCell) return;

    if (this.selectedCell.type === 'standard.Link') {
      this.saveRequested.emit({
        label: this.draftLabel().trim(),
      });
      return;
    }

    const isInitialNode =
      String(this.selectedCell.customData?.['tipo'] ?? '').toUpperCase() === 'INITIAL';
    const nextLabel = isInitialNode ? '' : this.draftLabel().trim() || 'Sin nombre';

    this.saveRequested.emit({
      label: nextLabel,
      width: Math.max(24, Number(this.draftWidth()) || 160),
      height: Math.max(18, Number(this.draftHeight()) || 60),
      templateDocumentId: this.draftTemplateDocumentId().trim(),
    });
  }

  onDelete(): void {
    this.deleteRequested.emit();
  }

  private syncFromSelectedCell(): void {
    const cell = this.selectedCell;

    if (!cell) {
      this.draftLabel.set('');
      this.draftWidth.set(160);
      this.draftHeight.set(60);
      this.draftTemplateDocumentId.set('');
      return;
    }

    if (cell.type === 'standard.Link') {
      this.draftLabel.set(this.getSelectedLinkLabel(cell));
      this.draftWidth.set(160);
      this.draftHeight.set(60);
      this.draftTemplateDocumentId.set('');
      return;
    }

    this.draftLabel.set(
      String(cell.attrs?.['label']?.['text'] ?? cell.customData?.['nombre'] ?? ''),
    );
    this.draftWidth.set(Number(cell.size?.width ?? 160));
    this.draftHeight.set(Number(cell.size?.height ?? 60));
    this.draftTemplateDocumentId.set(String(cell.customData?.['templateDocumentId'] ?? ''));
  }

  private getSelectedLinkLabel(cell: DiagramCell): string {
    if (cell.type !== 'standard.Link') return '';

    const labels = Array.isArray(cell.labels) ? cell.labels : [];
    const first = labels[0];
    const text = first?.attrs?.['text']?.['text'];
    const customDataText = cell.customData?.['linkLabel'];

    return String(text ?? customDataText ?? '');
  }
}
