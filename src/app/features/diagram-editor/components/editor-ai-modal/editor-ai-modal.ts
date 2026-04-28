import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { DiagramAiResponse } from '../../interfaces/diagram.models';

export type EditorAiMode = 'CREATE' | 'EDIT';

export interface EditorAiGeneratePayload {
  mode: EditorAiMode;
  userMessage: string;
}

@Component({
  selector: 'app-editor-ai-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './editor-ai-modal.html',
  styleUrl: './editor-ai-modal.css',
})
export class EditorAiModalComponent {
  @Input({ required: true }) isOpen = false;
  @Input({ required: true }) isLoading = false;
  @Input() response: DiagramAiResponse | null = null;
  @Input() errorMessage = '';

  @Output() closeRequested = new EventEmitter<void>();
  @Output() generateRequested = new EventEmitter<EditorAiGeneratePayload>();
  @Output() applyRequested = new EventEmitter<void>();

  protected readonly prompt = signal(
    'Crea un flujo de compra de vehículo. Debe incluir obligatoriamente un nodo ACTION inicial llamado Recepción de Solicitud en RECEPCIÓN. Luego verificar disponibilidad en VENTAS, decisión Si/No, preparar cotización, confirmar aceptación, decisión Si/No, registrar pago y finalizar. Si no está disponible o si el cliente no acepta, debe finalizar el proceso.',
  );

  protected onGenerate(mode: EditorAiMode): void {
    const value = this.prompt().trim();

    if (!value) {
      return;
    }

    this.generateRequested.emit({
      mode,
      userMessage: value,
    });
  }

  protected onPromptChange(value: string): void {
    this.prompt.set(value);
  }
}
