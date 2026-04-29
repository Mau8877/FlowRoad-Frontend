import { Component, computed, input } from '@angular/core';

import { StatusCountResponse } from '../../interfaces/dashboard-kpi.model';

@Component({
  selector: 'app-status-donut-chart',
  standalone: true,
  templateUrl: './status-donut-chart.html',
  styleUrl: './status-donut-chart.css',
})
export class StatusDonutChartComponent {
  readonly statuses = input.required<StatusCountResponse[]>();

  readonly total = computed(() => {
    return this.statuses().reduce((sum, item) => sum + item.count, 0);
  });

  donutGradient(): string {
    const total = this.total();

    if (total <= 0) {
      return 'conic-gradient(#e7e2dc 0deg 360deg)';
    }

    let start = 0;
    const segments: string[] = [];

    this.statuses().forEach((item, index) => {
      if (item.count <= 0) {
        return;
      }

      const angle = (item.count / total) * 360;
      const end = index === this.statuses().length - 1 ? 360 : start + angle;
      const color = this.statusColor(item.status);

      segments.push(`${color} ${start}deg ${end}deg`);
      start = end;
    });

    if (segments.length === 0) {
      return 'conic-gradient(#e7e2dc 0deg 360deg)';
    }

    return `conic-gradient(${segments.join(', ')})`;
  }

  percentage(count: number): number {
    const total = this.total();

    if (total <= 0) {
      return 0;
    }

    return Math.round((count / total) * 1000) / 10;
  }

  statusColor(status: string): string {
    switch (status) {
      case 'COMPLETED':
        return '#cc9e61';
      case 'RUNNING':
        return '#541f14';
      case 'PENDING_ASSIGNMENT':
        return '#938172';
      case 'CANCELLED':
        return '#b91c1c';
      default:
        return '#626266';
    }
  }
}
