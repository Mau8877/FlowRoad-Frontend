export interface FormField {
  name: string;
  label: string;
  type: 'text' | 'number' | 'select' | 'checkbox' | 'textarea';
  placeholder?: string;
  options?: { label: string; value: any }[];
  validators?: any[];
  gridCols?: 1 | 2;
}
