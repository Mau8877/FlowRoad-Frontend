import { Component, Input, Output, EventEmitter, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { FormField } from '../../interfaces/field.interface';
import {
  LucideAngularModule,
  LUCIDE_ICONS,
  LucideIconProvider,
  X,
  Save,
  AlertCircle,
  Plus,
} from 'lucide-angular';

@Component({
  selector: 'app-create-modal',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, LucideAngularModule],
  templateUrl: './create-modal.html',
  providers: [
    {
      provide: LUCIDE_ICONS,
      multi: true,
      useValue: new LucideIconProvider({ X, Save, AlertCircle, Plus }),
    },
  ],
})
export class CreateModal implements OnInit {
  private fb = inject(FormBuilder);

  @Input({ required: true }) title: string = '';
  @Input({ required: true }) fields: FormField[] = [];
  @Input() isOpen: boolean = false;

  @Output() onClose = new EventEmitter<void>();
  @Output() onSave = new EventEmitter<any>();

  // 👈 NUEVO: Emite cuando cualquier campo cambia su valor
  @Output() onFieldChange = new EventEmitter<{ name: string; value: any }>();

  public form!: FormGroup;

  ngOnInit(): void {
    this.initForm();
  }

  private initForm() {
    const group: any = {};
    this.fields.forEach((field) => {
      const initialValue = field.type === 'multiselect-chips' ? [] : '';
      group[field.name] = [initialValue, field.validators || []];
    });
    this.form = this.fb.group(group);

    // 👈 NUEVO: Escucha cambios globales en el formulario para avisar al padre
    // Esto sirve para que el componente Users reaccione al departamento inmediatamente
    this.form.valueChanges.subscribe((values) => {
      // Opcional: podrías emitir solo campos específicos si quieres optimizar
    });
  }

  /**
   * Método para capturar cambios en selects o inputs específicos
   * Se llamará desde el HTML
   */
  handleInputChange(fieldName: string, event: Event): void {
    const element = event.target as HTMLInputElement | HTMLSelectElement;
    const value = element.value;

    // Emitimos el cambio para que el padre (UsersComponent) pueda filtrar
    this.onFieldChange.emit({ name: fieldName, value });
  }

  // --- LÓGICA DE MULTISELECT-CHIPS (Se mantiene igual) ---

  addChip(fieldName: string, event: Event): void {
    const selectElement = event.target as HTMLSelectElement;
    const value = selectElement.value;
    if (!value) return;

    const currentValues: string[] = this.form.get(fieldName)?.value || [];
    if (!currentValues.includes(value)) {
      const updatedValues = [...currentValues, value];
      this.form.get(fieldName)?.setValue(updatedValues);

      // También emitimos cambio aquí por si acaso
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

  // --- MÉTODOS DE ACCIÓN ---

  submit() {
    if (this.form.valid) {
      this.onSave.emit(this.form.value);
      this.close();
    } else {
      this.form.markAllAsTouched();
    }
  }

  close() {
    this.form.reset();
    this.initForm();
    this.onClose.emit();
  }
}
