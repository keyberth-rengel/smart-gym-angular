import { Booking, TrainerCustomer } from '../models';
import { isUpcoming, nextBooking } from './booking-slots';
import { formatDayMonth, relativeDay, toIsoDate } from './dates';
import { WEEKDAYS, weekdayInfo, weekdayKeyFromDate } from './routine-blocks';

/** Lunes (a medianoche, hora local) de la semana que contiene a `date`. */
export function weekStart(date: Date): Date {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d;
}

export function addDays(date: Date, days: number): Date {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  d.setDate(d.getDate() + days);
  return d;
}

export interface WeekDay {
  /** yyyy-MM-dd */
  iso: string;
  date: Date;
  /** "Lun" */
  short: string;
  /** 19 */
  num: number;
  isToday: boolean;
}

/** Los siete días de la semana que empieza en `start` (lunes primero). */
export function weekDays(start: Date, now: Date = new Date()): WeekDay[] {
  const today = toIsoDate(now);
  return WEEKDAYS.map((w, i) => {
    const date = addDays(start, i);
    const iso = toIsoDate(date);
    return { iso, date, short: w.short, num: date.getDate(), isToday: iso === today };
  });
}

/** "14 – 20 sep" o "28 sep – 04 oct" cuando la semana cruza de mes. */
export function weekRangeLabel(start: Date): string {
  const end = addDays(start, 6);
  const a = formatDayMonth(start);
  const b = formatDayMonth(end);
  return start.getMonth() === end.getMonth() ? `${a.slice(0, 2)} – ${b}` : `${a} – ${b}`;
}

/** "Sábado 19 sep" */
export function dayHeading(date: Date): string {
  return `${weekdayInfo(weekdayKeyFromDate(date)).long} ${formatDayMonth(date)}`;
}

/** Reservas agrupadas por fecha (yyyy-MM-dd), cada día ordenado por hora. */
export function groupByDate(bookings: readonly Booking[]): Map<string, Booking[]> {
  const map = new Map<string, Booking[]>();
  for (const b of bookings) {
    const list = map.get(b.date) ?? [];
    list.push(b);
    map.set(b.date, list);
  }
  for (const list of map.values()) list.sort((a, b) => a.time.localeCompare(b.time));
  return map;
}

/** Minúsculas y sin acentos, para buscar sin distinguir "María" de "maria". */
export function normalize(text: string): string {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

/** Clientes cuyo nombre o correo contienen la búsqueda (sin acentos ni mayúsculas). */
export function filterCustomers<T extends Pick<TrainerCustomer, 'name' | 'email'>>(
  customers: readonly T[],
  query: string,
): T[] {
  const q = normalize(query);
  if (!q) return [...customers];
  return customers.filter((c) => normalize(c.name).includes(q) || normalize(c.email).includes(q));
}

/** Nombre del cliente a partir de su correo (sin distinguir mayúsculas), o el propio correo. */
export function customerName(
  customers: readonly Pick<TrainerCustomer, 'name' | 'email'>[],
  email: string,
): string {
  const key = email.trim().toLowerCase();
  return customers.find((c) => c.email.trim().toLowerCase() === key)?.name ?? email;
}

/** "Hoy 16:30" (hoy), "20 sep 16:30" (futura) o "12 sep" (pasada). */
export function customerLastLabel(
  c: Pick<TrainerCustomer, 'last_booking_date' | 'last_booking_time'>,
  now: Date = new Date(),
): string {
  const today = toIsoDate(now);
  const time = c.last_booking_time.slice(0, 5);
  if (c.last_booking_date === today) return `Hoy ${time}`;
  if (c.last_booking_date > today) return `${formatDayMonth(c.last_booking_date)} ${time}`;
  return relativeDay(c.last_booking_date, now);
}

/** Iniciales para el avatar: "Carlos Mendoza" -> "CM". */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  const first = parts[0][0];
  const last = parts.length > 1 ? parts[parts.length - 1][0] : '';
  return (first + last).toUpperCase();
}

export interface AgendaRow {
  id: number;
  /** "16:30" */
  time: string;
  /** Nombre del cliente; si no se conoce, su correo. */
  name: string;
  note: string | null;
  /** La siguiente cita de hoy que aún no pasó. */
  next: boolean;
}

/** Citas de un día (ya filtradas) con el nombre del cliente y la marca de "Próxima". */
export function agendaRows(
  bookings: readonly Booking[],
  customers: readonly Pick<TrainerCustomer, 'name' | 'email'>[],
  now: Date = new Date(),
): AgendaRow[] {
  const sorted = [...bookings].sort((a, b) => a.time.localeCompare(b.time));
  const upcoming = nextBooking(sorted, now);
  return sorted.map((b) => ({
    id: b.id,
    time: b.time.slice(0, 5),
    name: customerName(customers, b.customer_email),
    note: b.note,
    next: !!upcoming && upcoming.id === b.id && isUpcoming(b, now),
  }));
}
