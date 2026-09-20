import { Booking, Invitation } from '../models';
import { toIsoDate } from './dates';
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
