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
      useValue: new LucideIconProvider({ X, Save, AlertCircle }),
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
      group[field.name] = ['', field.validators || []];
    });
    this.form = this.fb.group(group);
  }

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
    this.onClose.emit();
  }
}
