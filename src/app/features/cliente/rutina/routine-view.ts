import { RoutineHistoryItem, RoutinePlan } from '../../../core/models';
import { WEEKDAYS, blockLabel } from '../../../core/util/routine-blocks';

export interface RoutineHistoryEntry {
  createdAt: string;
  active: boolean;
  /** "Piernas · Pecho · ..." en orden lunes a sábado. */
  summary: string;
}

/** La rutina activa es la última del historial (el backend lo entrega de antigua a reciente). */
export function activePlan(history: readonly RoutineHistoryItem[]): RoutinePlan | null {
  return history.length ? history[history.length - 1].plan : null;
}

/** Resumen de bloques traducidos de lunes a sábado; los días sin bloque se omiten. */
export function planSummary(plan: RoutinePlan): string {
  return WEEKDAYS.filter((d) => d.key !== 'sunday' && plan[d.key])
    .map((d) => blockLabel(plan[d.key]))
    .join(' · ');
}

/** Historial más reciente primero, con la rutina activa marcada. */
export function historyEntries(history: readonly RoutineHistoryItem[]): RoutineHistoryEntry[] {
  const lastIndex = history.length - 1;
  return history
    .map((item, index) => ({
      createdAt: item.created_at,
      active: index === lastIndex,
      summary: planSummary(item.plan),
    }))
    .reverse();
}
