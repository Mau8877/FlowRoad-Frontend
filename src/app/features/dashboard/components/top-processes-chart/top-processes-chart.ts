import { Component, computed, input } from '@angular/core';

import { PopularProcessResponse } from '../../interfaces/dashboard-kpi.model';

@Component({
  selector: 'app-top-processes-chart',
  standalone: true,
  templateUrl: './top-processes-chart.html',
  styleUrl: './top-processes-chart.css',
})
export class TopProcessesChartComponent {
  readonly processes = input.required<PopularProcessResponse[]>();

  readonly maxValue = computed(() => {
    const values = this.processes().map((item) => item.totalInstances);
    return values.length > 0 ? Math.max(...values, 0) : 0;
  });

  barWidth(value: number): number {
    const max = this.maxValue();

    if (max <= 0 || value <= 0) {
      return 0;
    }

    return Math.max(Math.round((value / max) * 100), 8);
  }
}
