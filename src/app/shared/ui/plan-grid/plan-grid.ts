import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { RoutinePlan } from '../../../core/models';
import { WEEKDAYS, blockLabel } from '../../../core/util/routine-blocks';

/** Plan semanal de lunes a sábado en una grilla de 3 x 2 con el bloque traducido de cada día. */
@Component({
  selector: 'app-plan-grid',
  template: `
    <ul class="plan-grid" [class.compact]="compact()" data-testid="plan-grid">
      @for (d of days(); track d.key) {
        <li class="plan-cell" data-testid="plan-cell">
          <span class="plan-day">{{ compact() ? d.short : d.long }}</span>
          <span class="plan-block">{{ d.block }}</span>
        </li>
      }
    </ul>
  `,
  styles: `
    :host {
      display: block;
    }
    .plan-grid {
      list-style: none;
      margin: 0;
      padding: 0;
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 10px;
    }
    .plan-cell {
      display: flex;
      flex-direction: column;
      min-width: 0;
      padding: 12px 14px;
      background: var(--sg-bg);
      border: 1px solid var(--sg-line);
      border-radius: 12px;
    }
    .plan-day {
      font-size: 0.8125rem;
      font-weight: 600;
      color: var(--sg-muted);
    }
    .plan-block {
      margin-top: 2px;
      font-family: var(--sg-font-display);
      font-weight: 700;
      font-size: 1.625rem;
      line-height: 1.1;
      word-break: keep-all;
    }
    /* espacio angosto (panel de detalle): letra menor para que "Hombros" no se parta */
    .compact .plan-cell {
      padding: 10px 12px;
    }
    .compact .plan-block {
      font-size: 1.25rem;
    }
    @media (max-width: 767.98px) {
      .plan-grid {
        gap: 8px;
      }
      .plan-cell {
        padding: 10px 12px;
      }
      .plan-block {
        font-size: 1.375rem;
      }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PlanGrid {
  readonly plan = input<RoutinePlan | null>(null);
  /** Etiqueta corta del día ("Lun") para espacios angostos. */
  readonly compact = input(false);

  protected readonly days = computed(() =>
    WEEKDAYS.filter((d) => d.key !== 'sunday').map((d) => ({
      ...d,
      block: blockLabel(this.plan()?.[d.key]),
    })),
  );
}
