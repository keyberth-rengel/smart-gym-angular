import { Booking } from '../models';

/** Horario de reservas del gimnasio (hora de pared, cada `SLOT_STEP_MIN` minutos). */
export const SLOT_START = '06:00';
export const SLOT_END = '21:30';
export const SLOT_STEP_MIN = 30;

export interface Slot {
  /** "HH:mm". */
  time: string;
  booked: boolean;
}

const pad = (n: number) => String(n).padStart(2, '0');

const minutes = (hhmm: string): number => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
};

/** Todas las horas del día, de `SLOT_START` a `SLOT_END` inclusive. */
export function allSlotTimes(): string[] {
  const out: string[] = [];
  for (let t = minutes(SLOT_START); t <= minutes(SLOT_END); t += SLOT_STEP_MIN) {
    out.push(`${pad(Math.floor(t / 60))}:${pad(t % 60)}`);
  }
  return out;
}

/**
 * Horas de hoy que se pueden mostrar: las pasadas se ocultan (el backend las rechaza si la
 * hora es anterior al instante actual, así que una hora igual al minuto actual ya es pasada
 * por los segundos) y las ocupadas se marcan.
 */
export function availableSlots(booked: readonly string[], now: Date = new Date()): Slot[] {
  const taken = new Set(booked.map((t) => t.slice(0, 5)));
  const nowSeconds = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();
  return allSlotTimes()
    .filter((time) => minutes(time) * 60 > nowSeconds)
    .map((time) => ({ time, booked: taken.has(time) }));
}

/** Fecha y hora de una reserva como Date local. */
export function bookingMoment(booking: Pick<Booking, 'date' | 'time'>): Date {
  const [y, mo, d] = booking.date.split('-').map(Number);
  const [h, mi] = booking.time.split(':').map(Number);
  return new Date(y, mo - 1, d, h, mi, 0, 0);
}

/** Una reserva es "próxima" si su fecha y hora no han pasado. */
export function isUpcoming(booking: Pick<Booking, 'date' | 'time'>, now: Date = new Date()): boolean {
  return bookingMoment(booking).getTime() >= now.getTime();
}

/** Más reciente primero (fecha y hora descendentes). */
export function sortBookingsDesc<T extends Pick<Booking, 'date' | 'time'>>(list: readonly T[]): T[] {
  return [...list].sort((a, b) => bookingMoment(b).getTime() - bookingMoment(a).getTime());
}

/** La reserva futura más cercana, o `null`. */
export function nextBooking<T extends Pick<Booking, 'date' | 'time'>>(
  list: readonly T[],
  now: Date = new Date(),
): T | null {
  const upcoming = list.filter((b) => isUpcoming(b, now));
  if (!upcoming.length) return null;
  return upcoming.reduce((best, b) => (bookingMoment(b) < bookingMoment(best) ? b : best));
}
