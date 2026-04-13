import {
  Component,
  Input,
  Output,
  EventEmitter,
  signal,
  computed,
  ContentChild,
  TemplateRef,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  LucideAngularModule,
  LUCIDE_ICONS,
  LucideIconProvider,
  Plus,
  Edit3,
  Trash2,
  Database,
  Search,
  ChevronLeft,
  ChevronRight,
  Users,
  Copy,
  ChevronUp,
  ChevronDown,
} from 'lucide-angular';
import { TableColumn } from './interfaces/column.interface';

@Component({
  selector: 'app-common-table',
  standalone: true,
  imports: [CommonModule, LucideAngularModule],
  templateUrl: './common-table.html',
  providers: [
    {
      provide: LUCIDE_ICONS,
      multi: true,
      useValue: new LucideIconProvider({
        Plus,
        Edit3,
        Trash2,
        Database,
        Search,
        ChevronLeft,
        ChevronRight,
        Users,
        Copy,
        ChevronUp,
        ChevronDown,
      }),
    },
  ],
})
export class CommonTable {
  // Inputs
  @Input({ required: true }) data = signal<any[]>([]);
  @Input({ required: true }) columns: TableColumn[] = [];
  @Input() title: string = '';
  @Input() subtitle: string = '';
  @Input() iconName: string = 'database';
  @Input() isLoading: boolean = false;

  // Outputs
  @Output() onEdit = new EventEmitter<any>();
  @Output() onDelete = new EventEmitter<any>();
  @Output() onAdd = new EventEmitter<void>();

  @ContentChild('customCell') customCell?: TemplateRef<any>;

  // Internals
  public Math = Math;
  public searchQuery = signal('');
  public currentPage = signal(0);
  public pageSize = 10;

  // Estado de ordenamiento
  // sortKey: columna actual, sortDir: 'asc' | 'desc' | null
  public sortKey = signal<string | null>(null);
  public sortDir = signal<'asc' | 'desc' | null>(null);

  // 1. Lógica de Filtrado y Ordenamiento
  public filteredData = computed(() => {
    let list = [...this.data()];
    const query = this.searchQuery().toLowerCase().trim();

    if (query) {
      list = list.filter((item) => {
        // A) Buscamos en el ID
        const matchId = String(item.id).toLowerCase().includes(query);

        // B) Buscamos en el resto de las columnas configuradas
        const matchColumns = this.columns.some((col) =>
          String(item[col.key]).toLowerCase().includes(query),
        );

        return matchId || matchColumns;
      });
    }

    // Ordenamiento (se mantiene igual)
    const key = this.sortKey();
    const dir = this.sortDir();
    if (key && dir) {
      list.sort((a, b) => {
        const valA = a[key];
        const valB = b[key];
        if (valA < valB) return dir === 'asc' ? -1 : 1;
        if (valA > valB) return dir === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return list;
  });

  public pagedData = computed(() => {
    const start = this.currentPage() * this.pageSize;
    return this.filteredData().slice(start, start + this.pageSize);
  });

  public stats = computed(() => {
    const list = this.data();
    return {
      total: list.length,
      active: list.filter((item) => item.isActive).length,
      inactive: list.filter((item) => !item.isActive).length,
    };
  });

  // Métodos
  onSearch(event: Event) {
    this.searchQuery.set((event.target as HTMLInputElement).value);
    this.currentPage.set(0);
  }

  // Toggle de ordenamiento: ASC -> DESC -> NULL
  toggleSort(key: string) {
    if (this.sortKey() !== key) {
      this.sortKey.set(key);
      this.sortDir.set('asc');
    } else {
      if (this.sortDir() === 'asc') {
        this.sortDir.set('desc');
      } else if (this.sortDir() === 'desc') {
        this.sortDir.set(null);
        this.sortKey.set(null);
      } else {
        this.sortDir.set('asc');
      }
    }
  }

  copyToClipboard(text: string) {
    navigator.clipboard.writeText(text);
  }

  formatId(id: string): string {
    if (!id || id.length < 8) return id;
    return `${id.substring(0, 3)}...${id.substring(id.length - 3)}`;
  }
}
