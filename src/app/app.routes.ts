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

/** Pantallas ya construidas, por ruta completa; el resto usa la página provisional. */
const PAGES: Record<string, Route['loadComponent']> = {
  '/cliente/rutina': () =>
    import('./features/cliente/rutina/rutina').then((m) => m.ClienteRutina),
  '/cliente/progreso': () =>
    import('./features/cliente/progreso/progreso').then((m) => m.ClienteProgreso),
  '/cliente/asistencia': () =>
    import('./features/cliente/asistencia/asistencia').then((m) => m.ClienteAsistencia),
};

/**
 * Rama de un rol: el shell como padre y un hijo por ítem del menú. Cada hijo apunta a una
 * página provisional hasta que su fase la reemplace (basta con cambiar su `loadComponent`).
 */
function roleBranch(role: Role): Route {
  return {
    path: role,
    canActivate: [authGuard, roleGuard([role]), profileCompleteGuard],
    loadComponent: () => import('./shared/layout/shell/shell').then((m) => m.Shell),
    children: NAV_ITEMS[role].map((item) => ({
      path: relativePath(item),
      pathMatch: item.exact ? ('full' as const) : ('prefix' as const),
      data: { title: item.label },
      loadComponent:
        PAGES[item.path] ??
        (() =>
          import('./shared/ui/placeholder-page/placeholder-page').then((m) => m.PlaceholderPage)),
    })),
  };
}

export const routes: Routes = [
  // "/" lleva al inicio del rol (o al inicio de sesión).
  { path: '', pathMatch: 'full', canActivate: [homeGuard], children: [] },
  {
    path: 'auth',
    children: [
      // Clerk usa subrutas internas (factor-one, verify-email-address, sso-callback...):
      // el matcher consume todos los segmentos que empiezan por sign-in / sign-up.
      {
        matcher: catchAllRoute('sign-in'),
        canActivate: [guestGuard],
        loadComponent: () => import('./features/auth/sign-in/sign-in').then((m) => m.SignIn),
      },
      {
        matcher: catchAllRoute('sign-up'),
        canActivate: [guestGuard],
        loadComponent: () => import('./features/auth/sign-up/sign-up').then((m) => m.SignUp),
      },
      {
        path: 'onboarding',
        canActivate: [authGuard, onboardingGuard],
        loadComponent: () =>
          import('./features/auth/onboarding/onboarding').then((m) => m.Onboarding),
      },
      {
        path: 'unavailable',
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
