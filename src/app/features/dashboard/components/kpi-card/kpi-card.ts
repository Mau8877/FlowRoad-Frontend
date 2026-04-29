import { Component, input } from '@angular/core';

@Component({
  selector: 'app-kpi-card',
  standalone: true,
  templateUrl: './kpi-card.html',
  styleUrl: './kpi-card.css',
})
export class KpiCardComponent {
  readonly title = input.required<string>();
  readonly value = input.required<string | number>();
  readonly helper = input<string>('');
  readonly description = input<string>('');
}
