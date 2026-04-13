export interface TableColumn {
  label: string;
  key: string;
  type?: 'text' | 'badge' | 'date' | 'custom';
}
