import { ROLES, ROLE_HOME } from '../auth/roles';
import { NAV_ITEMS, ROLE_BADGE, relativePath } from './nav-items';

describe('NAV_ITEMS', () => {
  const labels = (role: (typeof ROLES)[number]) => NAV_ITEMS[role].map((i) => i.label);

  it('cliente: Dashboard, Mi Rutina, Mi Progreso, Reservas, Asistencia', () => {
    expect(labels('cliente')).toEqual([
      'Dashboard',
      'Mi Rutina',
      'Mi Progreso',
      'Reservas',
      'Asistencia',
    ]);
  });

  it('entrenador: Dashboard, Mis citas, Mis clientes, Rutinas', () => {
    expect(labels('entrenador')).toEqual(['Dashboard', 'Mis citas', 'Mis clientes', 'Rutinas']);
  });

  it('admin: Dashboard, Clientes, Entrenadores, Reservas, Rutinas, Asistencia', () => {
    expect(labels('admin')).toEqual([
      'Dashboard',
      'Clientes',
      'Entrenadores',
      'Reservas',
      'Rutinas',
      'Asistencia',
    ]);
  });

  it.each(ROLES)('%s: el primer ítem es su inicio (exacto) y todas las rutas cuelgan de él', (role) => {
    const [first, ...rest] = NAV_ITEMS[role];
    expect(first.path).toBe(ROLE_HOME[role]);
    expect(first.exact).toBe(true);
    for (const item of rest) expect(item.path.startsWith(ROLE_HOME[role] + '/')).toBe(true);
  });

  it.each(ROLES)('%s: sin rutas ni etiquetas repetidas', (role) => {
    const items = NAV_ITEMS[role];
    expect(new Set(items.map((i) => i.path)).size).toBe(items.length);
    expect(new Set(items.map((i) => i.label)).size).toBe(items.length);
  });

  it('relativePath cuelga del padre del rol', () => {
    expect(relativePath({ label: '', path: '/cliente', icon: '' })).toBe('');
    expect(relativePath({ label: '', path: '/admin/reservas', icon: '' })).toBe('reservas');
  });

  it('solo entrenador y admin llevan badge de rol', () => {
    expect(ROLE_BADGE.cliente).toBeNull();
    expect(ROLE_BADGE.entrenador?.text).toBe('ENTRENADOR');
    expect(ROLE_BADGE.admin?.text).toBe('ADMIN');
  });
});
