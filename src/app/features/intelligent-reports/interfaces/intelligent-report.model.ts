export type ReportExportFormat = 'HTML' | 'PDF' | 'EXCEL';

export interface ReportPromptRequest {
  prompt: string;
}

export interface ReportExportRequest extends ReportPromptRequest {
  format: ReportExportFormat;
}

export interface ReportPreviewResponse {
  reportId?: string;
  title: string;
  summary: string;
  prompt?: string;
  generatedAt?: string;
  reportIntent?: string;
  dateRangeLabel?: string;
  dataSource?: string;
  columns: string[];
  rows: Record<string, unknown>[];
  chartType: 'BAR' | 'LINE' | 'PIE' | 'TABLE';
  chartData: Record<string, unknown>[];
  querySpec: Record<string, unknown>;
  warnings: string[];
}

export interface GeneratedReportHistoryResponse {
  id: string;
  title: string;
  prompt: string;
  chartType: string;
  rowCount: number;
  generatedAt: string;
}

export interface GeneratedReportHistoryPageResponse {
  content: GeneratedReportHistoryResponse[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
  first: boolean;
  last: boolean;
}

export interface ReportSuggestionsResponse {
  suggestions: string[];
}
