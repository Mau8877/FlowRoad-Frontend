import { DragDropModule } from '@angular/cdk/drag-drop';
import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FormArray, FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import {
  GripVertical,
  Hash,
  LUCIDE_ICONS,
  LucideAngularModule,
  LucideIconProvider,
  Paperclip,
  Plus,
  Trash2,
} from 'lucide-angular';

@Component({
  selector: 'app-field-card',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, LucideAngularModule, DragDropModule],
  templateUrl: './field-card.html',
  styleUrl: './field-card.css',
  providers: [
    {
      provide: LUCIDE_ICONS,
      multi: true,
      useValue: new LucideIconProvider({ GripVertical, Trash2, Hash, Paperclip, Plus }),
    },
  ],
})
export class FieldCard {
  @Input({ required: true }) group!: FormGroup;
  @Input() isPreview = false;
  @Input() index!: number;

  @Output() onRemove = new EventEmitter<number>();

  get hostClass() {
    const cols = this.group.get('uiProps.gridCols')?.value;
    return cols === 2 ? 'col-span-2' : 'col-span-1';
  }

  private fb = new FormBuilder();

  get uiProps() {
    return this.group.get('uiProps') as FormGroup;
  }

  get options() {
    return this.group.get('options') as FormArray;
  }

  get type() {
    return this.group.get('type')?.value;
  }

  // Solo mostramos el gestor si es de tipo selección
  get hasOptions() {
    const t = this.type?.toUpperCase();
    return ['SELECT', 'MULTIPLE_CHOICE', 'RADIO', 'CHECKBOX'].includes(t);
  }

  addOption() {
    this.options.push(
      this.fb.group({
        label: ['', Validators.required],
        value: ['', Validators.required],
      }),
    );
  }

  removeOption(index: number) {
    this.options.removeAt(index);
  }

  // Sincronizar el 'value' automáticamente con el 'label' si el usuario no lo toca
  syncValue(index: number) {
    const option = this.options.at(index);
    const label = option.get('label')?.value;
    if (label && !option.get('value')?.dirty) {
      option.get('value')?.setValue(label.toLowerCase().replace(/\s+/g, '_'));
    }
  }
}
