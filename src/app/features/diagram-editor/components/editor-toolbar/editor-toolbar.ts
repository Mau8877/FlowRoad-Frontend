import { DepartmentResponse } from '#/app/features/config-org/interfaces/departamentos.model';
import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { EditorTool } from '../../interfaces/diagram.models';

@Component({
  selector: 'app-editor-toolbar',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './editor-toolbar.html',
  styleUrl: './editor-toolbar.css',
})
export class EditorToolbarComponent {
  @Input({ required: true }) activeTool: EditorTool = 'PAN';
  @Input() availableDepartments: DepartmentResponse[] = [];
  @Input() selectedLaneDepartmentId = '';

  @Output() toolSelected = new EventEmitter<EditorTool>();
  @Output() aiRequested = new EventEmitter<void>();
  @Output() laneDepartmentChanged = new EventEmitter<string>();

  readonly tools: { key: EditorTool; label: string }[] = [
    { key: 'PAN', label: '✋ Mano' },
    { key: 'SELECT', label: '🖱️ Selección' },
    { key: 'LANE', label: '║ Lane' },
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

  onLaneDepartmentChange(value: string): void {
    this.laneDepartmentChanged.emit(value);
  }
}
