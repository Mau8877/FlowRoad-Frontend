import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';

@Component({
  selector: 'app-editor-debug-modal',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './editor-debug-modal.html',
  styleUrl: './editor-debug-modal.css',
})
export class EditorDebugModalComponent {
  @Input() isOpen = false;
  @Input() logs: string[] = [];

  @Output() closeRequested = new EventEmitter<void>();

  onClose(): void {
    this.closeRequested.emit();
  }

  trackByLog = (_index: number, item: string): string => item;
}
