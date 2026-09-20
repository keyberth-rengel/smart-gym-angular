import { Role } from '../auth/roles';

export interface NavItem {
  label: string;
  /** Ruta absoluta. */
  path: string;
  /** Nombre de bootstrap-icons sin el prefijo `bi-`. */
  icon: string;
  /** El inicio de cada rol solo se marca activo en su ruta exacta. */
  exact?: boolean;
}

/** Menú de cada rol: alimenta la barra lateral (escritorio) y las pestañas (móvil). */
export const NAV_ITEMS: Record<Role, readonly NavItem[]> = {
  cliente: [
    { label: 'Dashboard', path: '/cliente', icon: 'house-door', exact: true },
    { label: 'Mi Rutina', path: '/cliente/rutina', icon: 'lightning-charge' },
    { label: 'Mi Progreso', path: '/cliente/progreso', icon: 'graph-up-arrow' },
    { label: 'Reservas', path: '/cliente/reservas', icon: 'calendar-event' },
    { label: 'Asistencia', path: '/cliente/asistencia', icon: 'check2-circle' },
  ],
  entrenador: [
    { label: 'Dashboard', path: '/entrenador', icon: 'house-door', exact: true },
    { label: 'Mis citas', path: '/entrenador/citas', icon: 'calendar-event' },
    { label: 'Mis clientes', path: '/entrenador/clientes', icon: 'people' },
    { label: 'Rutinas', path: '/entrenador/rutinas', icon: 'lightning-charge' },
  ],
  admin: [
    { label: 'Dashboard', path: '/admin', icon: 'house-door', exact: true },
    { label: 'Clientes', path: '/admin/clientes', icon: 'people' },
    { label: 'Entrenadores', path: '/admin/entrenadores', icon: 'person-badge' },
    { label: 'Reservas', path: '/admin/reservas', icon: 'calendar-event' },
    { label: 'Rutinas', path: '/admin/rutinas', icon: 'lightning-charge' },
    { label: 'Asistencia', path: '/admin/asistencia', icon: 'check2-circle' },
  ],
};

export type BadgeTone = 'green' | 'blue' | 'red' | 'amber' | 'gray';

/** Etiqueta de rol que se muestra junto a la marca (el cliente no lleva). */
export const ROLE_BADGE: Record<Role, { text: string; tone: BadgeTone } | null> = {
  cliente: null,
  entrenador: { text: 'ENTRENADOR', tone: 'green' },
  admin: { text: 'ADMIN', tone: 'blue' },
};

export const ROLE_LABEL: Record<Role, string> = {
  cliente: 'Socio',
  entrenador: 'Entrenador',
  admin: 'Administración',
};

/** Ruta relativa al padre del rol (`/cliente/rutina` -> `rutina`; el inicio -> ''). */
export function relativePath(item: NavItem): string {
  return item.path.split('/').slice(2).join('/');
}
