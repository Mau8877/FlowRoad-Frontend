import { Injectable, NgZone, inject } from '@angular/core';
import { Observable, Subscriber } from 'rxjs';

export interface SpeechResult {
  transcript: string;
  isFinal: boolean;
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

@Injectable({
  providedIn: 'root',
})
export class SpeechService {
  private readonly ngZone = inject(NgZone);
  private currentInstance: BrowserSpeechRecognition | null = null;

  public isSupported(): boolean {
    return Boolean(this.getConstructor());
  }

  public listen(lang = 'es-ES'): Observable<SpeechResult> {
    return new Observable((subscriber: Subscriber<SpeechResult>) => {
      const Constructor = this.getConstructor();

      if (!Constructor) {
        this.ngZone.run(() => {
          subscriber.error(
            new Error(
              'El navegador no soporta reconocimiento de voz. Para tus pruebas usa Microsoft Edge.',
            ),
          );
        });
        return;
      }

      // Abortamos cualquier instancia previa para evitar colisiones
      this.abort();

      const recognition = new Constructor();
      this.currentInstance = recognition;

      recognition.lang = lang;
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.maxAlternatives = 1;

      recognition.onstart = () => {
        // Podríamos emitir algún evento de inicio si fuera necesario en el futuro
      };

      recognition.onresult = (event: BrowserSpeechRecognitionEvent) => {
        const transcript = this.extractTranscript(event);
        
        this.ngZone.run(() => {
          subscriber.next({ transcript, isFinal: false });
        });
      };

      recognition.onerror = (event: BrowserSpeechRecognitionErrorEvent) => {
        this.ngZone.run(() => {
          const error = event.error ?? event.message ?? 'desconocido';

          if (error === 'aborted') {
            subscriber.complete();
            return;
          }

          let message = `No se pudo completar el dictado. Error: ${error}.`;

          if (error === 'no-speech') {
            message = 'No se detectó voz. Intenta hablar más cerca del micrófono.';
          } else if (error === 'not-allowed') {
            message = 'El navegador bloqueó el micrófono. Revisa los permisos del sitio.';
          } else if (error === 'audio-capture') {
            message = 'No se pudo capturar audio. Revisa que el micrófono esté disponible.';
          } else if (error === 'network') {
            message = 'No se pudo conectar con el reconocimiento de voz. Prueba nuevamente en Edge.';
          }

          subscriber.error(new Error(message));
        });
      };

      recognition.onend = () => {
        this.ngZone.run(() => {
          subscriber.complete();
        });
      };

      try {
        recognition.start();
      } catch {
        this.ngZone.run(() => {
          subscriber.error(
            new Error('No se pudo iniciar el dictado. Recarga la página e intenta nuevamente.'),
          );
        });
      }

      // Teardown logic: se ejecuta al hacer unsubscribe()
      return () => {
        if (this.currentInstance === recognition) {
          try {
            this.currentInstance.abort();
          } catch {
            // Ignorar errores al abortar
          }
          this.currentInstance = null;
        }
      };
    });
  }

  public stop(): void {
    if (this.currentInstance) {
      try {
        this.currentInstance.stop();
      } catch {
        this.abort();
      }
    }
  }

  public abort(): void {
    if (this.currentInstance) {
      try {
        this.currentInstance.abort();
      } catch {
        // Ignorar
      }
      this.currentInstance = null;
    }
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

  private getConstructor(): BrowserSpeechRecognitionConstructor | null {
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
