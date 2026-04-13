import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  LucideAngularModule,
  LUCIDE_ICONS,
  LucideIconProvider,
  X,
  Trash2,
  AlertTriangle,
} from 'lucide-angular';

@Component({
  selector: 'app-delete-modal',
  standalone: true,
  imports: [CommonModule, LucideAngularModule],
  templateUrl: './delete-modal.html',
  providers: [
    {
      provide: LUCIDE_ICONS,
      multi: true,
      useValue: new LucideIconProvider({ X, Trash2, AlertTriangle }),
    },
  ],
})
export class DeleteModal {
  @Input() isOpen: boolean = false;
  @Input() title: string = 'Confirmar Acción';
  @Input() itemName: string = '';
  @Input() itemId: string = '';

  @Output() onClose = new EventEmitter<void>();
  @Output() onConfirm = new EventEmitter<void>();

  close() {
    this.onClose.emit();
  }

  confirm() {
    this.onConfirm.emit();
  }
}
