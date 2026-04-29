import { Component, computed, input } from '@angular/core';

import { DepartmentPendingTasksResponse } from '../../interfaces/dashboard-kpi.model';

@Component({
  selector: 'app-department-pending-card',
  standalone: true,
  templateUrl: './department-pending-card.html',
  styleUrl: './department-pending-card.css',
})
export class DepartmentPendingCardComponent {
  readonly departments = input.required<DepartmentPendingTasksResponse[]>();

  readonly maxValue = computed(() => {
    const values = this.departments().map((item) => item.pendingTasks);
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
