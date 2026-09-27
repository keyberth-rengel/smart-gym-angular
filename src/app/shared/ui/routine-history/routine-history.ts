import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { Badge } from '../badge/badge';

export interface RoutineHistoryRow {
  createdAt: string;
  /** "08 sep 2026" */
  date: string;
  /** "Piernas · Pecho · ..." */
  summary: string;
  active: boolean;
}

/** Lista del historial de rutinas (más reciente primero) con la activa marcada. */
@Component({
  selector: 'app-routine-history',
  imports: [Badge],
  template: `
    <ul class="hist-list" data-testid="history-list">
      @for (e of entries(); track e.createdAt) {
        <li class="hist-row" data-testid="history-row">
          <span class="hist-date">{{ e.date }}</span>
          <span class="hist-summary">{{ e.summary }}</span>
          @if (e.active) {
            <app-badge tone="green">Activa</app-badge>
          } @else {
            <app-badge tone="gray">Anterior</app-badge>
          }
        </li>
      }
    </ul>
  `,
  styles: `
    :host {
      display: block;
    }
    .hist-list {
      list-style: none;
      margin: 0;
      padding: 0;
      max-height: 480px;
      overflow-y: auto;
    }
    .hist-row {
      display: flex;
      align-items: center;
      gap: 16px;
      padding: 14px 0;
      border-bottom: 1px solid var(--sg-line);

      &:last-child {
        border-bottom: none;
      }
    }
    .hist-date {
      width: 110px;
      flex-shrink: 0;
      font-weight: 600;
      white-space: nowrap;
    }
    .hist-summary {
      flex-grow: 1;
      min-width: 0;
      font-size: 0.9375rem;
      color: var(--sg-muted);
    }
    @media (max-width: 767.98px) {
      .hist-summary {
        display: none;
      }
      .hist-date {
        flex-grow: 1;
      }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RoutineHistory {
  readonly entries = input.required<readonly RoutineHistoryRow[]>();
}
