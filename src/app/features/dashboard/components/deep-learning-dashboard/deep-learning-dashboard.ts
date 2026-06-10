import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal, effect } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { finalize } from 'rxjs';

import { DeepLearningAnalyticsService } from '../../services/deep-learning-analytics.service';
import { DeepLearningCurrentPredictionsResponse, DeepLearningPredictedItem } from '../../models/deep-learning-analytics.model';

interface DepartmentRiskSummary {
  name: string;
  taskCount: number;
  highCount: number;
  avgRisk: number;
}

interface BottleneckGroupSummary {
  diagramName: string;
  nodeId: string;
  avgBottleneckScore: number;
  maxDelayHours: number;
  avgRatio: number;
  occurrences: number;
  slaExceededCount: number;
}

@Component({
  selector: 'app-deep-learning-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './deep-learning-dashboard.html',
  styleUrl: './deep-learning-dashboard.css',
})
export class DeepLearningDashboardComponent implements OnInit {
  private readonly analyticsService = inject(DeepLearningAnalyticsService);

  readonly data = signal<DeepLearningCurrentPredictionsResponse | null>(null);
  readonly isLoading = signal(false);
  readonly errorMessage = signal<string | null>(null);

  // Filtros y límites
  readonly limit = signal(200);
  readonly searchQuery = signal('');
  readonly filterPriority = signal('ALL');
  readonly filterSla = signal('ALL');
  readonly filterDepartment = signal('ALL');

  // Paginación local
  readonly currentPage = signal(1);
  readonly pageSize = 10;

  constructor() {
    // Resetear paginación cuando cambie cualquier filtro
    effect(() => {
      this.searchQuery();
      this.filterPriority();
      this.filterSla();
      this.filterDepartment();
      this.limit();
      this.currentPage.set(1);
    }, { allowSignalWrites: true });
  }

  // Departamentos únicos para el filtro
  readonly departments = computed<string[]>(() => {
    const response = this.data();
    if (!response || !response.items) return [];
    
    const depts = response.items
      .map(item => item.assignedDepartmentName)
      .filter((name): name is string => !!name);
      
    return Array.from(new Set(depts)).sort();
  });

  // Lista de items filtrada localmente y ordenada de forma crítica
  readonly filteredItems = computed<DeepLearningPredictedItem[]>(() => {
    const response = this.data();
    if (!response || !response.items) return [];

    const query = this.searchQuery().toLowerCase().trim();
    const priority = this.filterPriority();
    const sla = this.filterSla();
    const dept = this.filterDepartment();

    // 1. Filtrar
    const items = response.items.filter(item => {
      const matchesSearch = !query || 
        (item.diagramName && item.diagramName.toLowerCase().includes(query)) ||
        (item.nodeId && item.nodeId.toLowerCase().includes(query)) ||
        (item.assignedDepartmentName && item.assignedDepartmentName.toLowerCase().includes(query));

      const matchesPriority = priority === 'ALL' || 
        (item.prediction && item.prediction.priorityLabel === priority);

      let matchesSla = true;
      if (sla === 'EXCEEDED') {
        matchesSla = !!(item.prediction && item.prediction.slaExceeded);
      } else if (sla === 'MET') {
        matchesSla = !(item.prediction && item.prediction.slaExceeded);
      }

      const matchesDept = dept === 'ALL' || 
        item.assignedDepartmentName === dept;

      return matchesSearch && matchesPriority && matchesSla && matchesDept;
    });

    // 2. Ordenamiento (HIGH -> MEDIUM -> NORMAL; luego por bottleneckScore, riskScore, slaExceeded)
    return [...items].sort((a, b) => {
      const aPriority = a.prediction?.priorityLabel || 'NORMAL';
      const bPriority = b.prediction?.priorityLabel || 'NORMAL';
      
      const aWeight = aPriority === 'HIGH' ? 3 : (aPriority === 'MEDIUM' ? 2 : 1);
      const bWeight = bPriority === 'HIGH' ? 3 : (bPriority === 'MEDIUM' ? 2 : 1);

      if (aWeight !== bWeight) {
        return bWeight - aWeight; // Descendente por peso
      }

      const aB = a.prediction?.bottleneckScore || 0;
      const bB = b.prediction?.bottleneckScore || 0;
      if (aB !== bB) {
        return bB - aB;
      }

      const aR = a.prediction?.riskScore || 0;
      const bR = b.prediction?.riskScore || 0;
      if (aR !== bR) {
        return bR - aR;
      }

      const aSla = a.prediction?.slaExceeded ? 1 : 0;
      const bSla = b.prediction?.slaExceeded ? 1 : 0;
      return bSla - aSla;
    });
  });

  // Métricas del subconjunto filtrado en tiempo real
  readonly filteredSummary = computed(() => {
    const items = this.filteredItems();
    const total = items.length;

    let normal = 0;
    let medium = 0;
    let high = 0;
    let bottleneck = 0;
    let slaExceeded = 0;

    for (const item of items) {
      const p = item.prediction?.priorityLabel || 'NORMAL';
      if (p === 'HIGH') high++;
      else if (p === 'MEDIUM') medium++;
      else normal++;

      if (item.prediction?.bottleneckScore && item.prediction.bottleneckScore > 0) {
        bottleneck++;
      }
      if (item.prediction?.slaExceeded) {
        slaExceeded++;
      }
    }

    return {
      total,
      normal,
      medium,
      high,
      bottleneck,
      slaExceeded,
      normalPercent: total > 0 ? (normal / total) * 100 : 0,
      mediumPercent: total > 0 ? (medium / total) * 100 : 0,
      highPercent: total > 0 ? (high / total) * 100 : 0,
      slaMetCount: total - slaExceeded,
      slaMetPercent: total > 0 ? ((total - slaExceeded) / total) * 100 : 0,
      slaExceededPercent: total > 0 ? (slaExceeded / total) * 100 : 0
    };
  });

  // Top 5 Departamentos con mayor riesgo filtrados
  readonly topDepartmentsRisk = computed<DepartmentRiskSummary[]>(() => {
    const items = this.filteredItems();
    const deptMap = new Map<string, { count: number; high: number; riskSum: number }>();

    for (const item of items) {
      const name = item.assignedDepartmentName || 'Sin departamento';
      const risk = item.prediction?.priorityScore || 0;
      const isHigh = item.prediction?.priorityLabel === 'HIGH' ? 1 : 0;

      const state = deptMap.get(name) || { count: 0, high: 0, riskSum: 0 };
      state.count++;
      state.high += isHigh;
      state.riskSum += risk;
      deptMap.set(name, state);
    }

    const summaries: DepartmentRiskSummary[] = [];
    deptMap.forEach((val, key) => {
      summaries.push({
        name: key,
        taskCount: val.count,
        highCount: val.high,
        avgRisk: Math.round((val.riskSum / val.count) * 100) / 100
      });
    });

    // Ordenar por promedio de riesgo descendente, luego por HIGH y retornar top 5
    return summaries
      .sort((a, b) => {
        if (b.avgRisk !== a.avgRisk) return b.avgRisk - a.avgRisk;
        return b.highCount - a.highCount;
      })
      .slice(0, 5);
  });

  // Top Cuellos de Botella Detectados
  readonly topBottlenecks = computed<BottleneckGroupSummary[]>(() => {
    const items = this.filteredItems();
    
    // Filtrar los que tienen bottleneckScore > 0
    const bottleneckItems = items.filter(item => item.prediction?.bottleneckScore && item.prediction.bottleneckScore > 0);

    const groupMap = new Map<string, { 
      diagramName: string; 
      nodeId: string; 
      scoreSum: number; 
      maxDelay: number; 
      ratioSum: number; 
      count: number; 
      slaExceeded: number;
    }>();

    for (const item of bottleneckItems) {
      const key = `${item.diagramName}::${item.nodeId}`;
      const state = groupMap.get(key) || {
        diagramName: item.diagramName || 'Desconocido',
        nodeId: item.nodeId || 'Desconocido',
        scoreSum: 0,
        maxDelay: 0,
        ratioSum: 0,
        count: 0,
        slaExceeded: 0
      };

      state.scoreSum += item.prediction.bottleneckScore || 0;
      
      const delay = item.prediction.bottleneckDelayHours || 0;
      if (delay > state.maxDelay) {
        state.maxDelay = delay;
      }

      state.ratioSum += item.prediction.bottleneckRatio || 0;
      state.count++;
      if (item.prediction.slaExceeded) {
        state.slaExceeded++;
      }

      groupMap.set(key, state);
    }

    const summaries: BottleneckGroupSummary[] = [];
    groupMap.forEach(val => {
      summaries.push({
        diagramName: val.diagramName,
        nodeId: val.nodeId,
        avgBottleneckScore: Math.min(100.0, val.count > 0 ? val.scoreSum / val.count : 0),
        maxDelayHours: val.maxDelay,
        avgRatio: val.count > 0 ? val.ratioSum / val.count : 0,
        occurrences: val.count,
        slaExceededCount: val.slaExceeded
      });
    });

    // Ordenar (descendente por avgBottleneckScore, luego maxDelayHours) y retornar top 8
    return summaries.sort((a, b) => {
      if (b.avgBottleneckScore !== a.avgBottleneckScore) {
        return b.avgBottleneckScore - a.avgBottleneckScore;
      }
      return b.maxDelayHours - a.maxDelayHours;
    }).slice(0, 8);
  });

  // Paginación local
  readonly totalPages = computed(() => {
    const total = this.filteredItems().length;
    return Math.max(1, Math.ceil(total / this.pageSize));
  });

  readonly paginatedItems = computed(() => {
    const items = this.filteredItems();
    const startIndex = (this.currentPage() - 1) * this.pageSize;
    return items.slice(startIndex, startIndex + this.pageSize);
  });

  readonly paginationLabel = computed(() => {
    const items = this.filteredItems();
    const total = items.length;
    if (total === 0) return 'Mostrando 0-0 de 0 resultados filtrados';
    const start = (this.currentPage() - 1) * this.pageSize + 1;
    const end = Math.min(this.currentPage() * this.pageSize, total);
    return `Mostrando ${start}-${end} de ${total} resultados filtrados`;
  });

  ngOnInit(): void {
    this.loadPredictions();
  }

  loadPredictions(): void {
    this.isLoading.set(true);
    this.errorMessage.set(null);

    this.analyticsService
      .getCurrentPredictions(this.limit())
      .pipe(finalize(() => this.isLoading.set(false)))
      .subscribe({
        next: (response) => {
          this.data.set(response);
        },
        error: (error) => {
          this.errorMessage.set(this.resolveErrorMessage(error));
        },
      });
  }

  onLimitChange(newLimit: number): void {
    this.limit.set(newLimit);
    this.loadPredictions();
  }

  prevPage(): void {
    if (this.currentPage() > 1) {
      this.currentPage.update(p => p - 1);
    }
  }

  nextPage(): void {
    if (this.currentPage() < this.totalPages()) {
      this.currentPage.update(p => p + 1);
    }
  }

  formatDate(value: string | undefined): string {
    if (!value) return 'Sin fecha';
    const date = new Date(value);
    if (isNaN(date.getTime())) return 'Sin fecha';
    
    return new Intl.DateTimeFormat('es-BO', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  }

  getPriorityClass(priority: string | undefined): string {
    if (!priority) return 'badge-normal';
    switch (priority.toUpperCase()) {
      case 'HIGH':
        return 'badge-high';
      case 'MEDIUM':
        return 'badge-medium';
      case 'NORMAL':
      default:
        return 'badge-normal';
    }
  }

  getActionClass(action: string | undefined): string {
    if (!action) return 'action-continue';
    switch (action.toUpperCase()) {
      case 'ESCALATE':
        return 'action-escalate';
      case 'REASSIGN':
        return 'action-reassign';
      case 'MONITOR':
        return 'action-monitor';
      case 'CONTINUE':
      default:
        return 'action-continue';
    }
  }

  formatNodeId(nodeId: string | undefined): string {
    if (!nodeId) return 'Desconocido';
    return nodeId.replace(/^node-/, '').replace(/-/g, ' ');
  }

  private resolveErrorMessage(error: any): string {
    if (error && error.error && error.error.message) {
      return error.error.message;
    }
    if (error && error.message) {
      return error.message;
    }
    return 'No se pudo conectar con el servidor de analíticas.';
  }
}
