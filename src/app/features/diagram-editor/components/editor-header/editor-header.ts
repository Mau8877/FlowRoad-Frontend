import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';

@Component({
  selector: 'app-editor-header',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './editor-header.html',
  styleUrl: './editor-header.css',
})
export class EditorHeaderComponent {
  @Input({ required: true }) diagramName = 'Diagrama sin nombre';
  @Input() sessionToken = '';
  @Input() isConnected = false;

  @Output() backClick = new EventEmitter<void>();
  @Output() debugClick = new EventEmitter<void>();
  @Output() settingsClick = new EventEmitter<void>();

  onBackClick(): void {
    this.backClick.emit();
  }

  onDebugClick(): void {
    this.debugClick.emit();
  }

  onSettingsClick(): void {
    this.settingsClick.emit();
  }
}
