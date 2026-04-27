import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { DiagramAiResponse } from '../../interfaces/diagram.models';

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
  @Output() generateRequested = new EventEmitter<string>();
  @Output() applyRequested = new EventEmitter<void>();

  protected readonly prompt = signal(
    'Crea un flujo de compra de vehículo. Debe incluir obligatoriamente un nodo ACTION inicial llamado Recepción de Solicitud en RECEPCIÓN. Luego verificar disponibilidad en VENTAS, decisión Si/No, preparar cotización, confirmar aceptación, decisión Si/No, registrar pago y finalizar. Si no está disponible o si el cliente no acepta, debe finalizar el proceso.',
  );

  protected onGenerate(): void {
    const value = this.prompt().trim();

    if (!value) {
      return;
    }

    this.generateRequested.emit(value);
  }

  protected onPromptChange(value: string): void {
    this.prompt.set(value);
  }
}
