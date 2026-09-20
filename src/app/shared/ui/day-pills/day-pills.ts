import { ChangeDetectionStrategy, Component, computed, input, model, output } from '@angular/core';
import { WeekdayKey } from '../../../core/models/routine';
import {
  REST_LABEL,
  WEEKDAYS,
  blockLabel,
  hasRoutineFor,
  todayKey,
} from '../../../core/util/routine-blocks';

export interface DayPick {
  day: WeekdayKey;
  /** `false` para el domingo: no hay plan que consultar en el API. */
  hasPlan: boolean;
}

/** Selector de los 7 días con su bloque de rutina. Compacto cuando el contenedor es angosto. */
@Component({
  selector: 'app-day-pills',
  templateUrl: './day-pills.html',
  styleUrl: './day-pills.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DayPills {
  /** Bloques del plan (valores del backend, en inglés) por día; si falta, solo se muestra el día. */
  readonly plan = input<Partial<Record<WeekdayKey, string | null>> | null>(null);
  readonly selected = model<WeekdayKey | null>(null);
  readonly today = input<WeekdayKey | null>(todayKey());
  readonly picked = output<DayPick>();

  protected readonly days = computed(() =>
    WEEKDAYS.map((d) => {
      const plan = this.plan();
      const rest = d.key === 'sunday';
      return {
        ...d,
        block: rest ? REST_LABEL : plan ? blockLabel(plan[d.key]) : '',
        // etiqueta corta para la variante compacta ("Descanso" no cabe en 46 px)
        blockShort: rest ? 'Desc.' : plan ? blockLabel(plan[d.key]) : '',
        isToday: d.key === this.today(),
        isSelected: d.key === this.selected(),
      };
    }),
  );

  protected pick(day: WeekdayKey): void {
    this.selected.set(day);
    this.picked.emit({ day, hasPlan: hasRoutineFor(day) });
  }

  /** Flechas, Inicio y Fin mueven el foco entre los días (Tab sigue funcionando). */
  protected onKeydown(event: KeyboardEvent, index: number): void {
    const buttons = Array.from(
      (event.currentTarget as HTMLElement).parentElement!.querySelectorAll<HTMLButtonElement>(
        'button',
      ),
    );
    let next = -1;
    if (event.key === 'ArrowRight') next = (index + 1) % buttons.length;
    else if (event.key === 'ArrowLeft') next = (index - 1 + buttons.length) % buttons.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = buttons.length - 1;
    if (next < 0) return;
    event.preventDefault();
    buttons[next].focus();
  }
}
