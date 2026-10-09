import {
  AttendanceRecord,
  Booking,
  ProgressList,
  RoutineHistoryItem,
  Trainer,
} from '../../../core/models';
import { nextBooking } from '../../../core/util/booking-slots';
import { trainerName } from '../../../core/util/booking-view';
import { formatDayMonth, formatTime, relativeDay, toTimestamp } from '../../../core/util/dates';
import { blockLabel, hasRoutineFor, todayKey } from '../../../core/util/routine-blocks';
import { fmt, sortAscending } from '../progreso/progress-stats';
import { activePlan } from '../rutina/routine-view';

/** Contenido de una tarjeta del dashboard ya listo para mostrar. */
export interface CardText {
  value: string;
  sub: string;
}

/** "Hoy · 06:45" o "12 sep · 17:40". */
function dayAndTime(dayValue: string, time: string, now: Date): string {
  const rel = relativeDay(dayValue, now);
  return `${rel} · ${time}`;
}

/** Bloque de hoy de la rutina activa (el domingo es "Descanso"). */
export function routineCard(
  history: readonly RoutineHistoryItem[],
  now: Date = new Date(),
): CardText {
  const plan = activePlan(history);
  if (!plan)
    return { value: 'Sin rutina asignada', sub: 'Tu entrenador o recepción te la asignará' };
  const key = todayKey(now);
  const since = formatDayMonth(history[history.length - 1].created_at);
  return {
    value: hasRoutineFor(key) ? blockLabel(plan[key]) : blockLabel(null),
    sub: `Plan de hoy · activa desde el ${since}`,
  };
}

/** La reserva futura más cercana, con el nombre del entrenador. */
export function nextBookingCard(
  bookings: readonly Booking[],
  trainers: readonly Trainer[],
  now: Date = new Date(),
): CardText {
  const next = nextBooking(bookings, now);
  if (!next) return { value: 'Sin reservas próximas', sub: 'Reserva una sesión con tu entrenador' };
  return {
    value: dayAndTime(next.date, next.time.slice(0, 5), now),
    sub: `con ${trainerName(trainers, next.trainer_email)}`,
  };
}

/** Último registro de progreso. */
export function progressCard(list: Pick<ProgressList, 'items'>): CardText {
  if (!list.items.length) return { value: 'Sin registros', sub: 'Registra tu primer progreso' };
  const latest = sortAscending(list.items).at(-1)!;
  return {
    value: `${fmt(latest.weight_kg)} kg`,
    sub: `${fmt(latest.body_fat_pct)} % grasa · ${fmt(latest.muscle_pct)} % músculo`,
  };
}

/** Último ingreso registrado. */
export function attendanceCard(
  records: readonly AttendanceRecord[],
  now: Date = new Date(),
): CardText {
  if (!records.length) return { value: 'Sin ingresos', sub: 'Marca tu asistencia al llegar' };
  const last = [...records]
    .sort((a, b) => toTimestamp(a.timestamp) - toTimestamp(b.timestamp))
    .at(-1)!;
  return {
    value: dayAndTime(last.timestamp, formatTime(last.timestamp), now),
    sub: 'Último ingreso registrado',
  };
}
