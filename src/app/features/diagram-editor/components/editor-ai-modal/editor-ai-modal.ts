import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  NgZone,
  OnDestroy,
  Output,
  computed,
  inject,
  signal,
} from '@angular/core';
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

export type EditorAiMode = 'CREATE' | 'EDIT';

export interface EditorAiGeneratePayload {
  mode: EditorAiMode;
  userMessage: string;
}

interface BrowserSpeechRecognitionAlternative {
  transcript: string;
  confidence?: number;
}

interface BrowserSpeechRecognitionResult {
  isFinal: boolean;
  length: number;
  [index: number]: BrowserSpeechRecognitionAlternative;
}

interface BrowserSpeechRecognitionResultList {
  length: number;
  [index: number]: BrowserSpeechRecognitionResult;
}

interface BrowserSpeechRecognitionEvent {
  resultIndex: number;
  results: BrowserSpeechRecognitionResultList;
}

interface BrowserSpeechRecognitionErrorEvent {
  error?: string;
  message?: string;
}

interface BrowserSpeechRecognition {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onstart: (() => void) | null;
  onend: (() => void) | null;
  onerror: ((event: BrowserSpeechRecognitionErrorEvent) => void) | null;
  onresult: ((event: BrowserSpeechRecognitionEvent) => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}

type BrowserSpeechRecognitionConstructor = new () => BrowserSpeechRecognition;

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

  private readonly ngZone = inject(NgZone);

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

  private speechRecognition: BrowserSpeechRecognition | null = null;
  private basePromptBeforeRecording = '';

  private readonly defaultPrompts: Record<EditorAiMode, string> = {
    CREATE:
      'Crea un flujo de compra de vehículo. Debe incluir obligatoriamente un nodo ACTION inicial llamado Recepción de Solicitud en RECEPCIÓN. Luego verificar disponibilidad en VENTAS, decisión Si/No, preparar cotización, confirmar aceptación, decisión Si/No, registrar pago y finalizar. Si no está disponible o si el cliente no acepta, debe finalizar el proceso.',
    EDIT: 'Quita la actividad "Nombre de la actividad". Mantén el resto del diagrama igual y reconecta el flujo para que siga siendo ejecutable.',
  };

  protected readonly prompt = signal(this.defaultPrompts.CREATE);

  protected readonly isSpeechSupported = computed(() => {
    return Boolean(this.getSpeechRecognitionConstructor());
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
    this.abortDictation();
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

    const SpeechRecognitionConstructor = this.getSpeechRecognitionConstructor();

    if (!SpeechRecognitionConstructor) {
      this.speechError.set(
        'El navegador no soporta reconocimiento de voz. Para tus pruebas usa Microsoft Edge.',
      );
      return;
    }

    this.abortDictation();

    const recognition = new SpeechRecognitionConstructor();

    this.speechRecognition = recognition;
    this.basePromptBeforeRecording = this.prompt().trim();

    recognition.lang = 'es-ES';
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      console.log('Speech-to-Text started');

      this.ngZone.run(() => {
        this.isRecording.set(true);
        this.speechError.set('');
      });
    };

    recognition.onresult = (event: BrowserSpeechRecognitionEvent) => {
      const transcript = this.extractTranscript(event);

      console.log('Speech-to-Text transcript:', transcript);

      this.ngZone.run(() => {
        if (!transcript) {
          return;
        }

        const merged = `${this.basePromptBeforeRecording} ${transcript}`
          .replace(/\s+/g, ' ')
          .trim();

        this.prompt.set(merged);
      });
    };

    recognition.onerror = (event: BrowserSpeechRecognitionErrorEvent) => {
      console.error('Speech-to-Text error:', event);

      this.ngZone.run(() => {
        this.isRecording.set(false);

        const error = event.error ?? event.message ?? 'desconocido';

        if (error === 'aborted') {
          return;
        }

        if (error === 'no-speech') {
          this.speechError.set('No se detectó voz. Intenta hablar más cerca del micrófono.');
          return;
        }

        if (error === 'not-allowed') {
          this.speechError.set('El navegador bloqueó el micrófono. Revisa los permisos del sitio.');
          return;
        }

        if (error === 'audio-capture') {
          this.speechError.set(
            'No se pudo capturar audio. Revisa que el micrófono esté conectado y disponible.',
          );
          return;
        }

        if (error === 'network') {
          this.speechError.set(
            'No se pudo conectar con el reconocimiento de voz del navegador. Recarga la página e intenta de nuevo en Edge.',
          );
          return;
        }

        this.speechError.set(`No se pudo completar el dictado por voz. Error: ${error}.`);
      });
    };

    recognition.onend = () => {
      console.log('Speech-to-Text ended');

      this.ngZone.run(() => {
        this.isRecording.set(false);
        this.speechRecognition = null;
      });
    };

    try {
      recognition.start();
    } catch {
      this.ngZone.run(() => {
        this.isRecording.set(false);
        this.speechRecognition = null;
        this.speechError.set(
          'No se pudo iniciar el dictado por voz. Recarga la página e intenta nuevamente.',
        );
      });
    }
  }

  private stopDictation(): void {
    if (!this.speechRecognition) {
      this.isRecording.set(false);
      return;
    }

    try {
      this.speechRecognition.stop();
    } catch {
      this.abortDictation();
    }
  }

  private abortDictation(): void {
    if (!this.speechRecognition) {
      this.isRecording.set(false);
      return;
    }

    try {
      this.speechRecognition.abort();
    } catch {
      // Solo limpiamos estado local.
    }

    this.speechRecognition = null;
    this.isRecording.set(false);
  }

  private extractTranscript(event: BrowserSpeechRecognitionEvent): string {
    const results = Array.from(
      { length: event.results.length },
      (_, index) => event.results[index],
    );

    return results
      .map((result) => result[0]?.transcript ?? '')
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private getSpeechRecognitionConstructor(): BrowserSpeechRecognitionConstructor | null {
    if (typeof window === 'undefined') {
      return null;
    }

    const speechWindow = window as Window & {
      SpeechRecognition?: BrowserSpeechRecognitionConstructor;
      webkitSpeechRecognition?: BrowserSpeechRecognitionConstructor;
    };

    return speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition ?? null;
  }
}
