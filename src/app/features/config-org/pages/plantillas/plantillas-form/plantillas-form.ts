import { CdkDragDrop, DragDropModule } from '@angular/cdk/drag-drop';
import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormArray, FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import {
  ArrowLeft,
  Camera,
  Eye,
  EyeOff,
  GripVertical,
  LUCIDE_ICONS,
  Layout,
  LucideAngularModule,
  LucideIconProvider,
  Plus,
  RefreshCw,
  Save,
  Trash2,
  X,
} from 'lucide-angular';
import { forkJoin, of } from 'rxjs';

import { FieldType } from '../../../interfaces/plantillas.models';
import { DepartmentService } from '../../../services/departamento.service';
import { TemplateService } from '../../../services/plantillas.service';
import { FieldCard } from './components/field-card/field-card';
import { FieldPreview } from './components/field-preview/field-preview';

@Component({
  selector: 'app-plantilla-form',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    LucideAngularModule,
    DragDropModule,
    FieldCard,
    FieldPreview,
  ],
  templateUrl: './plantillas-form.html',
  styleUrl: './plantillas-form.css',
  providers: [
    {
      provide: LUCIDE_ICONS,
      multi: true,
      useValue: new LucideIconProvider({
        ArrowLeft,
        Save,
        Plus,
        Trash2,
        GripVertical,
        Layout,
        X,
        Camera,
        Eye,
        EyeOff,
        RefreshCw,
      }),
    },
  ],
})
export class PlantillasForm implements OnInit {
  private fb = inject(FormBuilder);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private templateService = inject(TemplateService);
  private deptService = inject(DepartmentService);

  public isEditMode = signal(false);
  public templateId = signal<string | null>(null);
  public isLoading = signal(false);
  public isReady = signal(false); // Switch maestro de renderizado
  public isPreviewMode = signal(false);

  public departamentos = signal<{ label: string; value: string }[]>([]);
  public availableFieldTypes = Object.values(FieldType);

  public form = this.fb.group({
    name: ['', [Validators.required, Validators.minLength(3)]],
    description: [''],
    departmentId: ['', Validators.required],
    isActive: [true],
    fields: this.fb.array([]),
  });

  get fields() {
    return this.form.get('fields') as FormArray;
  }

  togglePreview() {
    this.isPreviewMode.update((val) => !val);
  }

  ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id');
    this.templateId.set(id);
    this.isEditMode.set(!!id);

    // UN SOLO PUNTO DE ENTRADA: Esperamos a que todo esté listo
    this.INITIALIZE_DATA(id);
  }

  reactivate() {
    const id = this.templateId();
    if (!id) return;

    this.isLoading.set(true);
    this.templateService.REACTIVATE(id).subscribe({
      next: (response) => {
        // Actualizamos el formulario con la respuesta del backend
        this.form.patchValue({ isActive: response.isActive });
        this.isLoading.set(false);
        // Opcional: Mostrar un toast de éxito
      },
      error: () => this.isLoading.set(false),
    });
  }

  private INITIALIZE_DATA(id: string | null) {
    this.isLoading.set(true);

    const deps$ = this.deptService.GET_BY_ORGANIZATION();
    const template$ = id ? this.templateService.GET_BY_ID(id) : of(null);

    forkJoin({
      deps: deps$,
      template: template$,
    }).subscribe({
      next: ({ deps, template }) => {
        // 1. Cargamos departamentos
        this.departamentos.set(deps.map((d) => ({ label: d.name, value: d.id })));

        // 2. Si es edición, cargamos la data de la plantilla
        if (template) {
          this.form.patchValue({
            name: template.name,
            description: template.description,
            departmentId: template.departmentId,
            isActive: template.isActive,
          });

          this.fields.clear();
          template.fields.forEach((field) => this.addField(field));
        }

        // 3. ¡LISTO! Liberamos el renderizado
        this.isReady.set(true);
        this.isLoading.set(false);
      },
      error: (err) => {
        console.error('Error inicializando FlowRoad:', err);
        this.isLoading.set(false);
      },
    });
  }

  // --- LÓGICA DEL CONSTRUCTOR ---

  createFieldGroup(data?: any): FormGroup {
    return this.fb.group({
      fieldId: [data?.fieldId || `f_${Date.now()}`],
      type: [data?.type || FieldType.TEXT, Validators.required],
      label: [data?.label || '', Validators.required],
      required: [data?.required || false],
      isInternalOnly: [data?.isInternalOnly || false],
      aiSuggestions: [data?.aiSuggestions || []],
      uiProps: this.fb.group({
        order: [data?.uiProps?.order || this.fields.length],
        gridCols: [data?.uiProps?.gridCols || 1],
        placeholder: [data?.uiProps?.placeholder || ''],
      }),
      options: this.fb.array(
        (data?.options || []).map((opt: any) =>
          this.fb.group({
            label: [opt.label, Validators.required],
            value: [opt.value, Validators.required],
          }),
        ),
      ),
    });
  }

  addField(fieldData?: any) {
    const uniqueId = fieldData?.fieldId || Math.random().toString(36).substring(2, 9);

    // 1. Mapeamos las opciones a FormGroups ANTES de pasarlas al FormArray
    const optionsGroups = (fieldData?.options || []).map((opt: any) =>
      this.fb.group({
        label: [opt.label || '', Validators.required],
        value: [opt.value || '', Validators.required],
      }),
    );

    // 2. Creamos el FormArray pasándole directamente el arreglo de grupos
    const optionsArray = this.fb.array(optionsGroups);

    // 3. Asignamos todo al grupo principal
    const fieldGroup = this.fb.group({
      fieldId: [uniqueId],
      type: [fieldData?.type || 'text', Validators.required],
      label: [fieldData?.label || '', Validators.required],
      required: [fieldData?.required || false],
      uiProps: this.fb.group({
        gridCols: [fieldData?.uiProps?.gridCols || 1],
      }),
      options: optionsArray,
    });

    this.fields.push(fieldGroup);
    this.form.markAsDirty();
  }

  removeField(index: number) {
    this.fields.removeAt(index);
    this.form.markAsDirty();
  }

  getOptions(fieldIndex: number) {
    return this.fields.at(fieldIndex).get('options') as FormArray;
  }

  addOption(fieldIndex: number) {
    const options = this.getOptions(fieldIndex);
    options.push(
      this.fb.group({
        label: ['', Validators.required],
        value: ['', Validators.required],
      }),
    );
  }

  removeOption(fieldIndex: number, optionIndex: number) {
    this.getOptions(fieldIndex).removeAt(optionIndex);
  }

  drop(event: CdkDragDrop<any[]>) {
    // Si lo suelta en el mismo lugar, no hacemos nada
    if (event.previousIndex === event.currentIndex) return;

    // 1. Extraemos el control de forma segura
    const movedControl = this.fields.at(event.previousIndex);

    // 2. Usamos los métodos NATIVOS del FormArray (¡Prohibido moveItemInArray aquí!)
    this.fields.removeAt(event.previousIndex);
    this.fields.insert(event.currentIndex, movedControl);

    // 3. Tu adición: Actualizamos el orden lógico de todos los campos
    this.fields.controls.forEach((control, index) => {
      control.get('uiProps.order')?.setValue(index);
    });

    // 4. Avisamos que el formulario cambió
    this.form.markAsDirty();
  }

  save() {
    if (this.form.invalid) {
      this.form.markAllAsTouched(); // Para mostrar errores visuales
      return;
    }

    this.isLoading.set(true);
    const payload = this.form.getRawValue();

    const request$ = this.isEditMode()
      ? this.templateService.UPDATE(this.templateId()!, payload as any)
      : this.templateService.CREATE(payload as any);

    request$.subscribe({
      next: () => this.router.navigate(['/config/plantillas']),
      error: () => this.isLoading.set(false),
    });
  }

  cancel() {
    this.router.navigate(['/config/plantillas']);
  }
}
