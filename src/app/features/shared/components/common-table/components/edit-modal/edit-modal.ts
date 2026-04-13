import {
  Component,
  Input,
  Output,
  EventEmitter,
  inject,
  OnChanges,
  SimpleChanges,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { FormField } from '../../interfaces/field.interface';
import {
  LucideAngularModule,
  LUCIDE_ICONS,
  LucideIconProvider,
  X,
  RefreshCw,
  AlertCircle,
  Power,
} from 'lucide-angular';

@Component({
  selector: 'app-edit-modal',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, LucideAngularModule],
  templateUrl: './edit-modal.html',
  providers: [
    {
      provide: LUCIDE_ICONS,
      multi: true,
      useValue: new LucideIconProvider({ X, RefreshCw, AlertCircle, Power }),
    },
  ],
})
export class EditModal implements OnChanges {
  private fb = inject(FormBuilder);

  @Input({ required: true }) title: string = '';
  @Input({ required: true }) fields: FormField[] = [];
  @Input({ required: true }) data: any = null;
  @Input() isOpen: boolean = false;

  @Output() onClose = new EventEmitter<void>();
  @Output() onSave = new EventEmitter<any>();

  public form!: FormGroup;

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['isOpen'] && this.isOpen && this.data) {
      this.initForm();
    }
  }

  private initForm() {
    const group: any = {};
    this.fields.forEach((field) => {
      group[field.name] = [this.data[field.name] ?? '', field.validators || []];
    });

    // Agregamos el campo isActive dinámicamente si los datos indican que está false
    if (this.data.isActive === false) {
      group['isActive'] = [false];
    }

    this.form = this.fb.group(group);
  }

  submit() {
    if (this.form.valid) {
      // Retornamos los datos del form + el ID original
      this.onSave.emit({ ...this.form.value, id: this.data.id });
      this.close();
    } else {
      this.form.markAllAsTouched();
    }
  }

  close() {
    this.onClose.emit();
  }
}
