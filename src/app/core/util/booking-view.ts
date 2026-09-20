import { Booking, Trainer } from '../models';
import { isUpcoming, sortBookingsDesc } from './booking-slots';
import { formatDayMonth, relativeDay } from './dates';

export interface BookingRow {
  id: number;
  /** "16:30" */
  time: string;
  /** Nombre del entrenador; si no se conoce, su correo. */
  trainer: string;
  /** "Hoy · 19 sep", "12 sep", "05 dic 2025" */
  day: string;
  upcoming: boolean;
  note: string | null;
}

/** Nombre del entrenador a partir de su correo (sin distinguir mayúsculas), o el propio correo. */
export function trainerName(trainers: readonly Trainer[], email: string): string {
  const key = email.trim().toLowerCase();
  return trainers.find((t) => t.email.trim().toLowerCase() === key)?.name ?? email;
}

/** "Hoy · 19 sep" para hoy; "12 sep" (o "05 dic 2025" de otro año) para otros días. */
export function bookingDayLabel(date: string, now: Date = new Date()): string {
  const rel = relativeDay(date, now);
  return rel === 'Hoy' ? `Hoy · ${formatDayMonth(date)}` : rel;
}

/** Reservas más recientes primero, con el nombre del entrenador y si son próximas. */
export function bookingRows(
  bookings: readonly Booking[],
  trainers: readonly Trainer[],
  now: Date = new Date(),
): BookingRow[] {
  return sortBookingsDesc(bookings).map((b) => ({
    id: b.id,
    time: b.time.slice(0, 5),
    trainer: trainerName(trainers, b.trainer_email),
    day: bookingDayLabel(b.date, now),
    upcoming: isUpcoming(b, now),
    note: b.note,
  }));
}
