import { Routes } from '@angular/router';
import { catchAllRoute } from 'ngx-clerk';
import {
  authGuard,
  guestGuard,
  homeGuard,
  onboardingGuard,
  profileCompleteGuard,
  roleGuard,
} from './core/auth/guards';

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
  {
    path: 'cliente',
    canActivate: [authGuard, roleGuard(['cliente']), profileCompleteGuard],
    loadComponent: () => import('./features/cliente/home/home').then((m) => m.ClienteHome),
  },
  {
    path: 'entrenador',
    canActivate: [authGuard, roleGuard(['entrenador']), profileCompleteGuard],
    loadComponent: () => import('./features/entrenador/home/home').then((m) => m.EntrenadorHome),
  },
  {
    path: 'admin',
    canActivate: [authGuard, roleGuard(['admin']), profileCompleteGuard],
    loadComponent: () => import('./features/admin/home/home').then((m) => m.AdminHome),
  },
  { path: '**', pathMatch: 'full', canActivate: [homeGuard], children: [] },
];
