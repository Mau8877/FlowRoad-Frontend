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
  Plus,
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
      useValue: new LucideIconProvider({ X, RefreshCw, AlertCircle, Power, Plus }),
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

  // 👈 NUEVO: Emisor para detectar cambios en cascada
  @Output() onFieldChange = new EventEmitter<{ name: string; value: any }>();

  public form!: FormGroup;

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['isOpen'] && this.isOpen && this.data) {
      this.initForm();
    }
  }

  private initForm() {
    const group: any = {};

    this.fields.forEach((field) => {
      let value = this.data[field.name];
      if (field.type === 'multiselect-chips') {
        if (Array.isArray(value)) {
          value = value.map((item: any) => (typeof item === 'object' ? item.id : item));
        } else {
          value = [];
        }
      }

      group[field.name] = [value ?? '', field.validators || []];
    });

    if (this.data.isActive !== undefined) {
      group['isActive'] = [this.data.isActive];
    }

    this.form = this.fb.group(group);
  }

  /**
   * 👈 NUEVO: Captura el cambio y notifica al UsersComponent
   */
  handleInputChange(fieldName: string, event: Event): void {
    const element = event.target as HTMLInputElement | HTMLSelectElement;
    const value = element.value;
    this.onFieldChange.emit({ name: fieldName, value });
  }

  // --- LÓGICA DE MULTISELECT-CHIPS ---

  addChip(fieldName: string, event: Event): void {
    const selectElement = event.target as HTMLSelectElement;
    const value = selectElement.value;
    if (!value) return;

    const currentValues: string[] = this.form.get(fieldName)?.value || [];
    if (!currentValues.includes(value)) {
      const updatedValues = [...currentValues, value];
      this.form.get(fieldName)?.setValue(updatedValues);
      this.onFieldChange.emit({ name: fieldName, value: updatedValues });
    }
    selectElement.value = '';
  }

  removeChip(fieldName: string, valueToRemove: string): void {
    const currentValues: string[] = this.form.get(fieldName)?.value || [];
    const updatedValues = currentValues.filter((v) => v !== valueToRemove);
    this.form.get(fieldName)?.setValue(updatedValues);
    this.onFieldChange.emit({ name: fieldName, value: updatedValues });
  }

  getAvailableOptions(field: FormField): any[] {
    const selectedValues: string[] = this.form.get(field.name)?.value || [];
    return field.options?.filter((opt) => !selectedValues.includes(opt.value)) || [];
  }

  getOptionLabel(field: FormField, value: string): string {
    return field.options?.find((opt) => opt.value === value)?.label || value;
  }

  // --- ACCIONES ---

  submit() {
    if (this.form.valid) {
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
