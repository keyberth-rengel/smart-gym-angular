import { WeekdayKey } from '../models/routine';

export interface WeekdayInfo {
  key: WeekdayKey;
  short: string;
  long: string;
}

/** Semana en el orden que se muestra en la UI (lunes primero). */
export const WEEKDAYS: readonly WeekdayInfo[] = [
  { key: 'monday', short: 'Lun', long: 'Lunes' },
  { key: 'tuesday', short: 'Mar', long: 'Martes' },
  { key: 'wednesday', short: 'Mié', long: 'Miércoles' },
  { key: 'thursday', short: 'Jue', long: 'Jueves' },
  { key: 'friday', short: 'Vie', long: 'Viernes' },
  { key: 'saturday', short: 'Sáb', long: 'Sábado' },
  { key: 'sunday', short: 'Dom', long: 'Domingo' },
];

const BLOCK_LABELS: Record<string, string> = {
  Legs: 'Piernas',
  Chest: 'Pecho',
  Back: 'Espalda',
  Shoulders: 'Hombros',
  Arms: 'Brazos',
  Cardio: 'Cardio',
};

export const REST_LABEL = 'Descanso';

/** Traduce un bloque del backend; sin bloque (p. ej. domingo) es "Descanso". */
export function blockLabel(block: string | null | undefined): string {
  if (!block) return REST_LABEL;
  return BLOCK_LABELS[block] ?? block;
}

const JS_DAY_TO_KEY: readonly WeekdayKey[] = [
  'sunday',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
];

export function weekdayKeyFromDate(date: Date): WeekdayKey {
  return JS_DAY_TO_KEY[date.getDay()];
}

export function todayKey(now: Date = new Date()): WeekdayKey {
  return weekdayKeyFromDate(now);
}

/** El backend solo genera plan de lunes a sábado: el domingo no se consulta al API. */
export function hasRoutineFor(day: WeekdayKey): boolean {
  return day !== 'sunday';
}

export function weekdayInfo(key: WeekdayKey): WeekdayInfo {
  return WEEKDAYS.find((d) => d.key === key)!;
}
