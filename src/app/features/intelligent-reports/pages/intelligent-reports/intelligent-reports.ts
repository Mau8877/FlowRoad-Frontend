import { CommonModule } from '@angular/common';
import { Component, computed, ElementRef, inject, OnInit, signal, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { finalize } from 'rxjs';

import {
  GeneratedReportHistoryResponse,
  GeneratedReportHistoryPageResponse,
  ReportExportFormat,
  ReportPreviewResponse,
} from '../../interfaces/intelligent-report.model';
import { IntelligentReportService } from '../../services/intelligent-report.service';

type SpeechRecognitionConstructor = new () => SpeechRecognition;

interface SpeechRecognition extends EventTarget {
  lang: string;
  interimResults: boolean;
  start(): void;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
}

interface SpeechRecognitionEvent {
  results: ArrayLike<{ 0: { transcript: string } }>;
}

interface ReportPromptCategory {
  title: string;
  examples: string[];
}

@Component({
  selector: 'app-intelligent-reports',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './intelligent-reports.html',
  styleUrl: './intelligent-reports.css',
})
export class IntelligentReportsPage implements OnInit {
  private readonly service = inject(IntelligentReportService);

  @ViewChild('promptInput') private readonly promptInput?: ElementRef<HTMLTextAreaElement>;

  readonly prompt = signal('');
  readonly report = signal<ReportPreviewResponse | null>(null);
  readonly history = signal<GeneratedReportHistoryResponse[]>([]);
  readonly historyPage = signal<GeneratedReportHistoryPageResponse | null>(null);
  readonly historyPageIndex = signal(0);
  readonly historyPageSize = 5;
  readonly isLoading = signal(false);
  readonly isExporting = signal<ReportExportFormat | null>(null);
  readonly isListening = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly promptCategories: ReportPromptCategory[] = [
    {
      title: 'Basicos',
      examples: [
        'Trámites por estado del último mes',
        'Trámites agrupados por departamento',
        'Cantidad de trámites por empresa',
        'Trámites por tipo de trámite',
      ],
    },
    {
      title: 'Tiempo',
      examples: [
        'Tiempo promedio por departamento',
        'Tiempo promedio por tipo de trámite',
        'Trámites con mayor tiempo de atención',
        'Trámites creados en los últimos 7 días',
      ],
    },
    {
      title: 'SLA',
      examples: [
        'Trámites con SLA vencido',
        'SLA vencido por departamento',
        'Porcentaje de SLA vencido por trámite',
        'Departamentos con más trámites atrasados',
      ],
    },
    {
      title: 'Riesgo e IA',
      examples: [
        'Trámites con mayor riesgo',
        'Riesgo promedio por departamento',
        'Cuellos de botella por departamento',
        'Prioridad de trámites según IA',
        'Riesgo, prioridad y cuello de botella del último mes',
      ],
    },
    {
      title: 'Historicos',
      examples: [
        'Trámites por día',
        'Trámites por semana',
        'Evolución mensual de trámites por estado',
        'Duración mensual de trámites',
      ],
    },
  ];

  readonly hasSpeechSupport = computed(() => this.getSpeechRecognitionConstructor() !== null);
  readonly chartRows = computed(() => {
    const report = this.report();
    if (!report || report.rows.length === 0 || report.columns.length < 2) {
      return [];
    }
    const labelColumn = report.columns[0];
    const valueColumn = this.firstNumericColumn(report) ?? report.columns[1];
    const values = report.rows.map((row) => Number(row[valueColumn]) || 0);
    const max = Math.max(...values, 1);
    return report.rows.slice(0, 8).map((row) => ({
      label: String(row[labelColumn] ?? ''),
      value: Number(row[valueColumn]) || 0,
      width: `${Math.max(4, ((Number(row[valueColumn]) || 0) / max) * 100)}%`,
    }));
  });

  ngOnInit(): void {
    this.loadHistory();
  }

  generate(): void {
    const prompt = this.prompt().trim();
    if (!prompt) {
      this.errorMessage.set('Escribe un prompt para generar el reporte.');
      return;
    }

    this.isLoading.set(true);
    this.errorMessage.set(null);
    this.service
      .preview(prompt)
      .pipe(finalize(() => this.isLoading.set(false)))
      .subscribe({
        next: (response) => {
          this.report.set(response);
          this.historyPageIndex.set(0);
          this.loadHistory();
        },
        error: (error) => this.errorMessage.set(this.resolveError(error)),
      });
  }

  useSuggestion(suggestion: string): void {
    this.prompt.set(suggestion);
    setTimeout(() => this.promptInput?.nativeElement.focus());
  }

  previousHistoryPage(): void {
    if (this.historyPageIndex() === 0) {
      return;
    }
    this.historyPageIndex.update((page) => page - 1);
    this.loadHistory();
  }

  nextHistoryPage(): void {
    const currentPage = this.historyPage();
    if (currentPage?.last) {
      return;
    }
    this.historyPageIndex.update((page) => page + 1);
    this.loadHistory();
  }

  export(format: ReportExportFormat): void {
    const prompt = this.prompt().trim();
    if (!prompt) {
      this.errorMessage.set('Genera o escribe un prompt antes de exportar.');
      return;
    }

    this.isExporting.set(format);
    this.errorMessage.set(null);
    this.service
      .export(prompt, format)
      .pipe(finalize(() => this.isExporting.set(null)))
      .subscribe({
        next: (blob) => this.download(blob, this.filename(format)),
        error: (error) => this.errorMessage.set(this.resolveError(error)),
      });
  }

  startDictation(): void {
    const Recognition = this.getSpeechRecognitionConstructor();
    if (!Recognition) {
      this.errorMessage.set('Dictado no soportado en este navegador.');
      return;
    }

    const recognition = new Recognition();
    recognition.lang = 'es-BO';
    recognition.interimResults = false;
    recognition.onresult = (event) => {
      const transcript = event.results[0]?.[0]?.transcript;
      if (transcript) {
        this.prompt.set(transcript);
      }
    };
    recognition.onerror = () => {
      this.errorMessage.set('No se pudo capturar el dictado.');
      this.isListening.set(false);
    };
    recognition.onend = () => this.isListening.set(false);
    this.isListening.set(true);
    recognition.start();
  }

  formatDate(value: string): string {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return 'Sin fecha';
    }
    return new Intl.DateTimeFormat('es-BO', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  }

  chartLabel(chartType: string): string {
    switch (chartType) {
      case 'BAR':
        return 'barras';
      case 'LINE':
        return 'líneas';
      case 'PIE':
        return 'circular';
      default:
        return 'tabla';
    }
  }

  private firstNumericColumn(report: ReportPreviewResponse): string | null {
    return (
      report.columns.find((column, index) => index > 0 && report.rows.some((row) => !Number.isNaN(Number(row[column])))) ??
      null
    );
  }

  private loadHistory(): void {
    this.service.historyPage(this.historyPageIndex(), this.historyPageSize).subscribe({
      next: (response) => {
        this.historyPage.set(response);
        this.history.set(response.content);
      },
      error: () => {
        this.historyPage.set(null);
        this.history.set([]);
      },
    });
  }

  private download(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  private filename(format: ReportExportFormat): string {
    const extension = format === 'EXCEL' ? 'xlsx' : format.toLowerCase();
    return `reporte-inteligente.${extension}`;
  }

  private getSpeechRecognitionConstructor(): SpeechRecognitionConstructor | null {
    const win = window as unknown as {
      SpeechRecognition?: SpeechRecognitionConstructor;
      webkitSpeechRecognition?: SpeechRecognitionConstructor;
    };
    return win.SpeechRecognition ?? win.webkitSpeechRecognition ?? null;
  }

  private resolveError(error: unknown): string {
    if (
      typeof error === 'object' &&
      error !== null &&
      'error' in error &&
      typeof error.error === 'object' &&
      error.error !== null &&
      'message' in error.error
    ) {
      return String(error.error.message);
    }
    if (typeof error === 'object' && error !== null && 'status' in error && error.status === 403) {
      return 'Acceso denegado. Solo ADMIN puede generar reportes inteligentes.';
    }
    return 'No se pudo completar la operación solicitada.';
  }
}
