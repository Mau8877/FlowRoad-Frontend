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

  public form!: FormGroup;

  ngOnInit(): void {
    this.initForm();
  }

  private initForm() {
    const group: any = {};
    this.fields.forEach((field) => {
      // Si es multiselect, el valor inicial debe ser un array []
      const initialValue = field.type === 'multiselect-chips' ? [] : '';
      group[field.name] = [initialValue, field.validators || []];
    });
    this.form = this.fb.group(group);
  }

  // --- LÓGICA DE MULTISELECT-CHIPS ---

  /**
   * Agrega un ID al array del formulario y resetea el select visual
   */
  addChip(fieldName: string, event: Event): void {
    const selectElement = event.target as HTMLSelectElement;
    const value = selectElement.value;

    if (!value) return;

    const currentValues: string[] = this.form.get(fieldName)?.value || [];

    if (!currentValues.includes(value)) {
      const updatedValues = [...currentValues, value];
      this.form.get(fieldName)?.setValue(updatedValues);
    }

    selectElement.value = '';
  }

  /**
   * Elimina un ID del array
   */
  removeChip(fieldName: string, valueToRemove: string): void {
    const currentValues: string[] = this.form.get(fieldName)?.value || [];
    const updatedValues = currentValues.filter((v) => v !== valueToRemove);
    this.form.get(fieldName)?.setValue(updatedValues);
  }

  /**
   * Retorna solo las opciones que NO han sido seleccionadas aún
   */
  getAvailableOptions(field: FormField): any[] {
    const selectedValues: string[] = this.form.get(field.name)?.value || [];
    return field.options?.filter((opt) => !selectedValues.includes(opt.value)) || [];
  }

  /**
   * Obtiene la etiqueta (label) de un ID seleccionado para mostrarla en el Chip
   */
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
