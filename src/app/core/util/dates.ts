const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;

const pad = (n: number) => String(n).padStart(2, '0');

/** yyyy-MM-dd se interpreta en hora local (evita el desfase de zona horaria de `new Date(iso)`). */
function toDate(value: string | Date): Date {
  if (value instanceof Date) return value;
  const m = DATE_ONLY.exec(value);
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return new Date(value);
}

/** Fecha local en formato yyyy-MM-dd (para consultas al API). */
export function toIsoDate(date: Date = new Date()): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** "15 sep 2026" */
export function formatDate(value: string | Date): string {
  const d = toDate(value);
  return `${pad(d.getDate())} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

/** "06:45" a partir de un Date, un ISO con hora o un "HH:mm[:ss]". */
export function formatTime(value: string | Date): string {
  if (typeof value === 'string' && /^\d{2}:\d{2}(:\d{2})?$/.test(value)) return value.slice(0, 5);
  const d = toDate(value);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** "15 sep 2026 · 06:45" */
export function formatDateTime(value: string | Date): string {
  return `${formatDate(value)} · ${formatTime(value)}`;
}

export function isToday(value: string | Date, now: Date = new Date()): boolean {
  return toIsoDate(toDate(value)) === toIsoDate(now);
}

/** "Hoy" o "15 sep 2026". */
export function dayLabel(value: string | Date, now: Date = new Date()): string {
  return isToday(value, now) ? 'Hoy' : formatDate(value);
}

/** "15 sep" (fecha sin año, para tablas angostas). */
export function formatDayMonth(value: string | Date): string {
  const d = toDate(value);
  return `${pad(d.getDate())} ${MONTHS[d.getMonth()]}`;
}

/** "2026" */
export function formatYear(value: string | Date): string {
  return String(toDate(value).getFullYear());
}

const WEEKDAYS_LONG = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const MONTHS_LONG = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
];

/** "Sábado, 19 de septiembre de 2026" */
export function formatLongDate(value: string | Date): string {
  const d = toDate(value);
  return `${WEEKDAYS_LONG[d.getDay()]}, ${d.getDate()} de ${MONTHS_LONG[d.getMonth()]} de ${d.getFullYear()}`;
}

/** "hoy, 19 sep 2026" */
export function todayLabel(now: Date = new Date()): string {
  return `hoy, ${formatDate(now)}`;
}

/**
 * Día de una reserva o ingreso: "Hoy", o "20 sep" (con el año si no es el actual).
 * `withYear` fuerza el año.
 */
export function relativeDay(
  value: string | Date,
  now: Date = new Date(),
  withYear = false,
): string {
  if (isToday(value, now)) return 'Hoy';
  const d = toDate(value);
  return withYear || d.getFullYear() !== now.getFullYear() ? formatDate(d) : formatDayMonth(d);
}
