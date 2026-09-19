export type WeekdayKey =
  'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';

/** Plan semanal: el backend solo genera de lunes a sábado. Los bloques vienen en inglés. */
export type RoutinePlan = Partial<Record<WeekdayKey, string>>;

export interface RoutineHistoryItem {
  /** Fecha y hora local sin zona, p. ej. 2026-09-19T14:20:36.239982. */
  created_at: string;
  plan: RoutinePlan;
}

export interface ActiveRoutineBlock {
  day: WeekdayKey;
  block: string;
}
