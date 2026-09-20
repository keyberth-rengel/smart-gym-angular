export type Role = 'cliente' | 'entrenador' | 'admin';

export const ROLES: readonly Role[] = ['cliente', 'entrenador', 'admin'];

/** Ruta de inicio de cada rol. */
export const ROLE_HOME: Record<Role, string> = {
  cliente: '/cliente',
  entrenador: '/entrenador',
  admin: '/admin',
};

export const SIGN_IN_PATH = '/auth/sign-in';
export const ONBOARDING_PATH = '/auth/onboarding';
export const UNAVAILABLE_PATH = '/auth/unavailable';
export const CONFIRM_DNI_PATH = '/auth/confirm-dni';

/**
 * Rol a partir de `public_metadata.role` de Clerk. Sin metadata (o con un valor
 * desconocido) el usuario es cliente: cualquiera puede registrarse, y los roles
 * entrenador y admin los asigna el administrador en Clerk.
 */
export function parseRole(value: unknown): Role {
  const role = typeof value === 'string' ? value.trim().toLowerCase() : '';
  return (ROLES as readonly string[]).includes(role) ? (role as Role) : 'cliente';
}
