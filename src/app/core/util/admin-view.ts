import { AttendanceRecord, Booking, Invitation } from '../models';
import { formatDate, formatTime, relativeDay, toIsoDate } from './dates';
import { customerName, filterCustomers } from './trainer-view';

/** Edad máxima que acepta el formulario del admin (el backend solo exige >= 0). */
export const ADMIN_MAX_AGE = 120;

/** Ordena por nombre en español (sin distinguir acentos ni mayúsculas); no modifica el original. */
export function sortByName<T extends { name: string }>(list: readonly T[]): T[] {
  return [...list].sort((a, b) => a.name.localeCompare(b.name, 'es', { sensitivity: 'base' }));
}

/** Personas cuyo nombre o correo contienen la búsqueda (sin acentos ni mayúsculas). */
export const filterPeople = filterCustomers;

export interface TodayBookingRow {
  id: number;
  /** "16:30" */
  time: string;
  /** Nombre del cliente; si no se conoce, su correo. */
  customer: string;
  /** Nombre del entrenador; si no se conoce, su correo. */
  trainer: string;
}

type Named = { name: string; email: string };

/** Reservas cuya fecha es hoy, por hora, con los nombres resueltos (o el correo si faltan). */
export function todayBookings(
  bookings: readonly Booking[],
  customers: readonly Named[],
  trainers: readonly Named[],
  now: Date = new Date(),
): TodayBookingRow[] {
  const today = toIsoDate(now);
  return bookings
    .filter((b) => b.date === today)
    .sort((a, b) => a.time.localeCompare(b.time))
    .map((b) => ({
      id: b.id,
      time: b.time.slice(0, 5),
      customer: customerName(customers, b.customer_email),
      trainer: customerName(trainers, b.trainer_email),
    }));
}

export interface InvitationOutcome {
  tone: 'success' | 'warning' | 'danger';
  text: string;
}

/**
 * Mensaje para el resultado de invitar a un entrenador. `created` distingue el alta
 * (el entrenador ya quedó registrado) del reenvío desde la tabla.
 */
export function invitationOutcome(
  invitation: Invitation,
  email: string,
  created: boolean,
): InvitationOutcome {
  const lead = created ? 'Entrenador registrado. ' : '';
  switch (invitation.status) {
    case 'INVITED':
      return {
        tone: 'success',
        text: created ? `${lead}Invitación enviada por correo.` : `Invitación enviada a ${email}.`,
      };
    case 'ROLE_UPDATED':
      return {
        tone: 'success',
        text: created
          ? `${lead}Esa persona ya tenía cuenta: ahora tiene el rol Entrenador (debe cerrar y abrir sesión).`
          : `${email} ya tenía cuenta: ahora tiene el rol Entrenador (debe cerrar y abrir sesión).`,
      };
    case 'SKIPPED':
      return {
        tone: 'warning',
        text: created
          ? 'Entrenador registrado, pero las invitaciones no están configuradas en el servidor.'
          : 'Las invitaciones no están configuradas en el servidor.',
      };
    default:
      return {
        tone: 'danger',
        text: created
          ? 'Entrenador registrado, pero no se pudo enviar la invitación. Puedes reintentarla desde la tabla.'
          : 'No se pudo enviar la invitación. Inténtalo de nuevo.',
      };
  }
}

// ---------------------------------------------------------------------------------------------
// Reservas del admin
// ---------------------------------------------------------------------------------------------

export interface BookingFilters {
  /** Correo del entrenador; vacío = todos. */
  trainerEmail: string;
  /** yyyy-MM-dd; vacío = todas las fechas. */
  date: string;
}

/** Reservas que cumplen los filtros (correo sin distinguir mayúsculas; fecha exacta). */
export function filterBookings(
  bookings: readonly Booking[],
  filters: BookingFilters,
): Booking[] {
  const trainer = filters.trainerEmail.trim().toLowerCase();
  return bookings.filter(
    (b) =>
      (!trainer || b.trainer_email.trim().toLowerCase() === trainer) &&
      (!filters.date || b.date === filters.date),
  );
}

export interface AdminBookingRow {
  id: number;
  /** yyyy-MM-dd */
  date: string;
  /** "16:30" */
  time: string;
  /** "Hoy" o "12 sep 2026". */
  dayLabel: string;
  customer: string;
  customerEmail: string;
  trainer: string;
  trainerEmail: string;
  note: string;
}

/** Filas para la tabla: más reciente primero (fecha y hora) y con los nombres resueltos. */
export function adminBookingRows(
  bookings: readonly Booking[],
  customers: readonly Named[],
  trainers: readonly Named[],
  now: Date = new Date(),
): AdminBookingRow[] {
  return [...bookings]
    .sort(
      (a, b) =>
        b.date.localeCompare(a.date) ||
        b.time.slice(0, 5).localeCompare(a.time.slice(0, 5)) ||
        b.id - a.id,
    )
    .map((b) => ({
      id: b.id,
      date: b.date,
      time: b.time.slice(0, 5),
      dayLabel: relativeDay(b.date, now, true),
      customer: customerName(customers, b.customer_email),
      customerEmail: b.customer_email,
      trainer: customerName(trainers, b.trainer_email),
      trainerEmail: b.trainer_email,
      note: b.note?.trim() ?? '',
    }));
}

/** "Hoy 16:30 · Carlos Mendoza con Lucía Paredes" para el diálogo de cancelar. */
export function bookingSummary(row: AdminBookingRow): string {
  return `${row.dayLabel} ${row.time} · ${row.customer} con ${row.trainer}`;
}

/**
 * Opciones del filtro de entrenador: la lista de entrenadores y, si esa carga falló, los correos
 * distintos que aparecen en las reservas (para poder seguir filtrando).
 */
export function trainerOptions(
  trainers: readonly Named[],
  bookings: readonly Booking[],
): Named[] {
  if (trainers.length) return sortByName(trainers);
  const seen = new Map<string, Named>();
  for (const b of bookings) {
    const key = b.trainer_email.trim().toLowerCase();
    if (!seen.has(key)) seen.set(key, { email: b.trainer_email, name: b.trainer_email });
  }
  return [...seen.values()].sort((a, b) => a.email.localeCompare(b.email));
}

// ---------------------------------------------------------------------------------------------
// Asistencia del admin
// ---------------------------------------------------------------------------------------------

const WELCOME = /^Welcome (.+?)! Access recorded for (.+?)\.?\s*$/;

export interface Welcome {
  name: string;
  email: string;
}

/** Extrae nombre y correo del texto en inglés que devuelve `POST /access`; null si no coincide. */
export function parseWelcome(raw: string | null | undefined): Welcome | null {
  const m = raw ? WELCOME.exec(raw.trim()) : null;
  return m ? { name: m[1], email: m[2] } : null;
}

/** Mensaje en español para el ingreso registrado (con respaldo genérico si el texto cambia). */
export function welcomeMessage(raw: string | null | undefined): string {
  const w = parseWelcome(raw);
  return w
    ? `¡Bienvenido ${w.name}! Ingreso registrado para ${w.email}.`
    : 'Ingreso registrado correctamente.';
}

export interface AttendanceRow {
  id: number;
  /** "15 sep 2026" */
  date: string;
  /** "06:45" */
  time: string;
  email: string;
  role: 'CUSTOMER' | 'TRAINER';
  roleLabel: 'Cliente' | 'Entrenador';
  tone: 'blue' | 'green';
}

/** Ingresos más recientes primero, con la etiqueta del rol (Cliente azul, Entrenador verde). */
export function attendanceRows(records: readonly AttendanceRecord[]): AttendanceRow[] {
  return [...records]
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp) || b.id - a.id)
    .map((r) => ({
      id: r.id,
      date: formatDate(r.timestamp),
      time: formatTime(r.timestamp),
      email: r.email,
      role: r.role,
      roleLabel: r.role === 'TRAINER' ? 'Entrenador' : 'Cliente',
      tone: r.role === 'TRAINER' ? 'green' : 'blue',
    }));
}
