import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { EditorTool } from '../../interfaces/diagram.models';

@Component({
  selector: 'app-editor-toolbar',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './editor-toolbar.html',
  styleUrl: './editor-toolbar.css',
})
export class EditorToolbarComponent {
  @Input({ required: true }) activeTool: EditorTool = 'PAN';

  @Output() toolSelected = new EventEmitter<EditorTool>();
  @Output() aiRequested = new EventEmitter<void>();

  readonly tools: { key: EditorTool; label: string }[] = [
    { key: 'PAN', label: '✋ Mano' },
    { key: 'SELECT', label: '🖱️ Selección' },
    { key: 'INITIAL', label: '● Inicio' },
    { key: 'ACTION', label: '▭ Acción' },
    { key: 'DECISION', label: '◇ Decisión' },
    { key: 'FORK_JOIN', label: '▬ Fork/Join' },
    { key: 'FINAL', label: '◎ Final' },
    { key: 'LINK', label: '→ Conector' },
  ];

  onSelectTool(tool: EditorTool): void {
    this.toolSelected.emit(tool);
  }

  onAi(): void {
    this.aiRequested.emit();
  }
}