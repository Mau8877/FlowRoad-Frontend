import { DepartmentResponse } from '#/app/features/config-org/interfaces/departamentos.model';
import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  Circle,
  CircleDot,
  Columns2,
  Diamond,
  GitMerge,
  Hand,
  LUCIDE_ICONS,
  LucideAngularModule,
  LucideIconProvider,
  Minus,
  MousePointer2,
  RectangleHorizontal,
  Sparkles,
  ZoomIn,
  ZoomOut,
} from 'lucide-angular';
import { EditorTool } from '../../interfaces/diagram.models';

@Component({
  selector: 'app-editor-toolbar',
  standalone: true,
  imports: [CommonModule, FormsModule, LucideAngularModule],
  templateUrl: './editor-toolbar.html',
  styleUrl: './editor-toolbar.css',
  providers: [
    {
      provide: LUCIDE_ICONS,
      multi: true,
      useValue: new LucideIconProvider({
        Sparkles,
        MousePointer2,
        Hand,
        GitMerge,
        Columns2,
        Circle,
        RectangleHorizontal,
        Diamond,
        Minus,
        CircleDot,
        ZoomIn,
        ZoomOut,
      }),
    },
  ],
})
export class EditorToolbarComponent {
  @Input({ required: true }) activeTool: EditorTool = 'PAN';
  @Input() availableDepartments: DepartmentResponse[] = [];
  @Input() selectedLaneDepartmentId = '';

  @Output() toolSelected = new EventEmitter<EditorTool>();
  @Output() aiRequested = new EventEmitter<void>();
  @Output() laneDepartmentChanged = new EventEmitter<string>();
  @Output() zoomInRequested = new EventEmitter<void>();
  @Output() zoomOutRequested = new EventEmitter<void>();

  readonly navigationTools: { key: EditorTool; label: string; icon: string }[] = [
    { key: 'SELECT', label: 'Selección', icon: 'mouse-pointer-2' },
    { key: 'PAN', label: 'Pan', icon: 'hand' },
    { key: 'LINK', label: 'Conector', icon: 'git-merge' },
  ];

  readonly structureTools: { key: EditorTool; label: string; icon: string }[] = [
    { key: 'LANE', label: 'Lane', icon: 'columns-2' },
    { key: 'INITIAL', label: 'Inicio', icon: 'circle' },
    { key: 'ACTION', label: 'Acción', icon: 'rectangle-horizontal' },
    { key: 'DECISION', label: 'Decisión', icon: 'diamond' },
    { key: 'FORK_JOIN', label: 'Fork/Join', icon: 'minus' },
    { key: 'FINAL', label: 'Final', icon: 'circle-dot' },
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

  onZoomIn(): void {
    this.zoomInRequested.emit();
  }

  onZoomOut(): void {
    this.zoomOutRequested.emit();
  }

  isToolActive(tool: EditorTool): boolean {
    return this.activeTool === tool;
  }
}
