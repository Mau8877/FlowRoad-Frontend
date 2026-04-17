import {
  Component,
  Input,
  Output,
  EventEmitter,
  signal,
  computed,
  ContentChild,
  TemplateRef,
  inject,
  ChangeDetectorRef,
  effect,
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
  Building2,
  Clock,
  Tag,
  Mail,
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
        Building2,
        Clock,
        Tag,
        Mail,
      }),
    },
  ],
})
export class CommonTable {
  // Inyecciones
  private cd = inject(ChangeDetectorRef);

  // Inputs
  @Input({ required: true }) data = signal<any[]>([]);
  @Input({ required: true }) columns: TableColumn[] = [];
  @Input() title = '';
  @Input() subtitle = '';
  @Input() iconName = 'database';
  @Input() isLoading = false;

  // Outputs
  @Output() onEdit = new EventEmitter<any>();
  @Output() onDelete = new EventEmitter<any>();
  @Output() onAdd = new EventEmitter<void>();

  // Buscamos el template que viene del padre
  @ContentChild('customCell', { descendants: true }) customCell?: TemplateRef<any>;

  // Internals
  public Math = Math;
  public searchQuery = signal('');
  public currentPage = signal(0);
  public pageSize = 10;

  public sortKey = signal<string | null>(null);
  public sortDir = signal<'asc' | 'desc' | null>(null);

  constructor() {
    /**
     * EFECTO DE DETECCIÓN:
     * Cada vez que el signal de 'data' cambia, forzamos a Angular
     * a re-chequear la vista. Esto evita que las columnas se vean mal
     * hasta que interactúas con la página.
     */
    effect(() => {
      this.data();

      setTimeout(() => {
        this.cd.markForCheck();
        this.cd.detectChanges();
      }, 0);
    });
  }

  // 1. Lógica de Filtrado y Ordenamiento
  public filteredData = computed(() => {
    let list = [...this.data()];
    const query = this.searchQuery().toLowerCase().trim();

    if (query) {
      list = list.filter((item) => {
        const matchId = String(item.id).toLowerCase().includes(query);
        const matchColumns = this.columns.some((col) =>
          String(item[col.key]).toLowerCase().includes(query),
        );
        return matchId || matchColumns;
      });
    }

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
