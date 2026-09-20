import { Route, Routes } from '@angular/router';
import { catchAllRoute } from 'ngx-clerk';
import {
  authGuard,
  guestGuard,
  homeGuard,
  onboardingGuard,
  profileCompleteGuard,
  roleGuard,
} from './core/auth/guards';
import { Role } from './core/auth/roles';
import { NAV_ITEMS, relativePath } from './core/nav/nav-items';

/** Pantalla de cada ítem del menú, por ruta completa. */
const PAGES: Record<string, NonNullable<Route['loadComponent']>> = {
  '/cliente': () =>
    import('./features/cliente/dashboard/dashboard').then((m) => m.ClienteDashboard),
  '/cliente/reservas': () =>
    import('./features/cliente/reservas/reservas').then((m) => m.ClienteReservas),
  '/cliente/rutina': () => import('./features/cliente/rutina/rutina').then((m) => m.ClienteRutina),
  '/cliente/progreso': () =>
    import('./features/cliente/progreso/progreso').then((m) => m.ClienteProgreso),
  '/cliente/asistencia': () =>
    import('./features/cliente/asistencia/asistencia').then((m) => m.ClienteAsistencia),
  '/entrenador': () =>
    import('./features/entrenador/dashboard/dashboard').then((m) => m.EntrenadorDashboard),
  '/entrenador/citas': () =>
    import('./features/entrenador/citas/citas').then((m) => m.EntrenadorCitas),
  '/entrenador/clientes': () =>
    import('./features/entrenador/clientes/clientes').then((m) => m.EntrenadorClientes),
  '/entrenador/rutinas': () =>
    import('./features/entrenador/rutinas/rutinas').then((m) => m.EntrenadorRutinas),
  '/admin': () => import('./features/admin/dashboard/dashboard').then((m) => m.AdminDashboard),
  '/admin/clientes': () =>
    import('./features/admin/clientes/clientes').then((m) => m.AdminClientes),
  '/admin/entrenadores': () =>
    import('./features/admin/entrenadores/entrenadores').then((m) => m.AdminEntrenadores),
  '/admin/reservas': () =>
    import('./features/admin/reservas/reservas').then((m) => m.AdminReservas),
  '/admin/rutinas': () => import('./features/admin/rutinas/rutinas').then((m) => m.AdminRutinas),
  '/admin/asistencia': () =>
    import('./features/admin/asistencia/asistencia').then((m) => m.AdminAsistencia),
};

/**
 * Rama de un rol: el shell como padre y un hijo por ítem del menú, con su pantalla y su título.
 */
function roleBranch(role: Role): Route {
  return {
    path: role,
    canActivate: [authGuard, roleGuard([role]), profileCompleteGuard],
    loadComponent: () => import('./shared/layout/shell/shell').then((m) => m.Shell),
    children: NAV_ITEMS[role].map((item) => ({
      path: relativePath(item),
      pathMatch: item.exact ? ('full' as const) : ('prefix' as const),
      title: item.label,
      loadComponent: PAGES[item.path],
    })),
  };
}

export const routes: Routes = [
  // "/" lleva al inicio del rol (o al inicio de sesión).
  { path: '', pathMatch: 'full', canActivate: [homeGuard], children: [] },
  {
    path: 'auth',
    children: [
      // Clerk usa subrutas internas (factor-one, verify-email-address...):
      // el matcher consume todos los segmentos que empiezan por sign-in / sign-up.
      {
        matcher: catchAllRoute('sign-in'),
        title: 'Iniciar sesión',
        canActivate: [guestGuard],
        loadComponent: () => import('./features/auth/sign-in/sign-in').then((m) => m.SignIn),
      },
      {
        matcher: catchAllRoute('sign-up'),
        title: 'Crear cuenta',
        canActivate: [guestGuard],
        loadComponent: () => import('./features/auth/sign-up/sign-up').then((m) => m.SignUp),
      },
      {
        path: 'onboarding',
        title: 'Completar perfil',
        canActivate: [authGuard, onboardingGuard],
        loadComponent: () =>
          import('./features/auth/onboarding/onboarding').then((m) => m.Onboarding),
      },
      {
        path: 'unavailable',
        title: 'Servicio no disponible',
        canActivate: [authGuard],
        loadComponent: () =>
          import('./features/auth/unavailable/unavailable').then((m) => m.Unavailable),
      },
      { path: '', pathMatch: 'full', redirectTo: 'sign-in' },
    ],
  },
  roleBranch('cliente'),
  roleBranch('entrenador'),
  roleBranch('admin'),
  { path: '**', pathMatch: 'full', canActivate: [homeGuard], children: [] },
];
