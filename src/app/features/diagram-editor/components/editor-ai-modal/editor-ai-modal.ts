import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  OnDestroy,
  Output,
  computed,
  inject,
  signal,
} from '@angular/core';
import { Subscription } from 'rxjs';
import { FormsModule } from '@angular/forms';
import {
  AlertTriangle,
  Bot,
  Check,
  FileText,
  LucideAngularModule,
  Mic,
  MicOff,
  PencilLine,
  PlusCircle,
  Sparkles,
  Wand2,
  X,
} from 'lucide-angular';

import { DiagramAiResponse } from '../../interfaces/diagram.models';
import { SpeechService } from '#/app/core/services/speech.service';

export type EditorAiMode = 'CREATE' | 'EDIT';

export interface EditorAiGeneratePayload {
  mode: EditorAiMode;
  userMessage: string;
}


@Component({
  selector: 'app-editor-ai-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, LucideAngularModule],
  templateUrl: './editor-ai-modal.html',
  styleUrl: './editor-ai-modal.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EditorAiModalComponent implements OnDestroy {
  @Input({ required: true }) isOpen = false;
  @Input({ required: true }) isLoading = false;
  @Input() response: DiagramAiResponse | null = null;
  @Input() errorMessage = '';

  @Output() closeRequested = new EventEmitter<void>();
  @Output() generateRequested = new EventEmitter<EditorAiGeneratePayload>();
  @Output() applyRequested = new EventEmitter<void>();

  private readonly speechService = inject(SpeechService);

  protected readonly icons = {
    AlertTriangle,
    Bot,
    Check,
    FileText,
    Mic,
    MicOff,
    PencilLine,
    PlusCircle,
    Sparkles,
    Wand2,
    X,
  };

  protected readonly selectedMode = signal<EditorAiMode>('CREATE');
  protected readonly isRecording = signal(false);
  protected readonly speechError = signal('');

  private speechSubscription: Subscription | null = null;
  private basePromptBeforeRecording = '';

  private readonly defaultPrompts: Record<EditorAiMode, string> = {
    CREATE:
      'Crea un flujo de compra de vehículo. Debe incluir obligatoriamente un nodo ACTION inicial llamado Recepción de Solicitud en RECEPCIÓN. Luego verificar disponibilidad en VENTAS, decisión Si/No, preparar cotización, confirmar aceptación, decisión Si/No, registrar pago y finalizar. Si no está disponible o si el cliente no acepta, debe finalizar el proceso.',
    EDIT: 'Quita la actividad "Nombre de la actividad". Mantén el resto del diagrama igual y reconecta el flujo para que siga siendo ejecutable.',
  };

  protected readonly prompt = signal(this.defaultPrompts.CREATE);

  protected readonly isSpeechSupported = computed(() => {
    return this.speechService.isSupported();
  });

  protected readonly modeTitle = computed(() => {
    return this.selectedMode() === 'CREATE' ? 'Crear nuevo diagrama' : 'Editar diagrama actual';
  });

  protected readonly modeDescription = computed(() => {
    return this.selectedMode() === 'CREATE'
      ? 'La IA generará una propuesta nueva respetando departamentos, nodos y plantillas.'
      : 'La IA modificará el diagrama actual manteniendo la estructura existente en lo posible.';
  });

  protected readonly generateButtonLabel = computed(() => {
    if (this.isLoading) {
      return this.selectedMode() === 'CREATE' ? 'Generando propuesta...' : 'Editando propuesta...';
    }

    return this.selectedMode() === 'CREATE' ? 'Generar propuesta' : 'Editar propuesta';
  });

  ngOnDestroy(): void {
    if (this.speechSubscription) {
      this.speechSubscription.unsubscribe();
    }
  }

  protected setMode(mode: EditorAiMode): void {
    if (this.selectedMode() === mode) {
      return;
    }

    const currentPrompt = this.prompt().trim();
    const currentDefaultPrompt = this.defaultPrompts[this.selectedMode()].trim();

    this.selectedMode.set(mode);
    this.speechError.set('');

    if (!currentPrompt || currentPrompt === currentDefaultPrompt) {
      this.prompt.set(this.defaultPrompts[mode]);
    }
  }

  protected onGenerate(): void {
    const value = this.prompt().trim();

    if (!value || this.isLoading) {
      return;
    }

    this.generateRequested.emit({
      mode: this.selectedMode(),
      userMessage: value,
    });
  }

  protected onPromptChange(value: string): void {
    this.prompt.set(value);
    this.speechError.set('');
  }

  protected toggleDictation(): void {
    if (this.isLoading) {
      return;
    }

    if (this.isRecording()) {
      this.stopDictation();
      return;
    }

    this.startDictation();
  }

  private startDictation(): void {
    this.speechError.set('');

    if (!this.speechService.isSupported()) {
      this.speechError.set(
        'El navegador no soporta reconocimiento de voz. Para tus pruebas usa Microsoft Edge.',
      );
      return;
    }

    if (this.speechSubscription) {
      this.speechSubscription.unsubscribe();
    }

    this.basePromptBeforeRecording = this.prompt().trim();
    this.isRecording.set(true);

    this.speechSubscription = this.speechService.listen().subscribe({
      next: (result) => {
        const merged = `${this.basePromptBeforeRecording} ${result.transcript}`
          .replace(/\s+/g, ' ')
          .trim();

        this.prompt.set(merged);
      },
      error: (error: Error) => {
        this.isRecording.set(false);
        this.speechError.set(error.message);
        this.speechSubscription = null;
      },
      complete: () => {
        this.isRecording.set(false);
        this.speechSubscription = null;
      },
    });
  }

  private stopDictation(): void {
    if (!this.speechSubscription) {
      this.isRecording.set(false);
      return;
    }

    this.speechService.stop();
  }

  private abortDictation(): void {
    if (this.speechSubscription) {
      this.speechSubscription.unsubscribe();
      this.speechSubscription = null;
    }

    this.isRecording.set(false);
  }


}
