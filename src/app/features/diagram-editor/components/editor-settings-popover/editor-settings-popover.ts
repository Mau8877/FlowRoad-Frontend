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

export interface EditorSettingsSubmitPayload {
  name: string;
  description: string;
}

@Component({
  selector: 'app-editor-settings-popover',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './editor-settings-popover.html',
  styleUrl: './editor-settings-popover.css',
})
export class EditorSettingsPopoverComponent implements OnChanges {
  @Input() isOpen = false;
  @Input() currentName = '';
  @Input() currentDescription = '';
  @Input() isSaving = false;

  @Output() closeRequested = new EventEmitter<void>();
  @Output() saveRequested = new EventEmitter<EditorSettingsSubmitPayload>();

  public draftName = signal('');
  public draftDescription = signal('');

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['currentName'] || changes['currentDescription'] || changes['isOpen']) {
      this.resetDrafts();
    }
  }

  onClose(): void {
    this.closeRequested.emit();
  }

  onSave(): void {
    const name = this.draftName().trim();
    const description = this.draftDescription().trim();

    if (!name) return;

    this.saveRequested.emit({
      name,
      description,
    });
  }

  private resetDrafts(): void {
    this.draftName.set(this.currentName ?? '');
    this.draftDescription.set(this.currentDescription ?? '');
  }
}
