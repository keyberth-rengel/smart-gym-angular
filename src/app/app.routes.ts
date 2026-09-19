import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'dev/theme' },
  {
    path: 'dev/theme',
    loadComponent: () =>
      import('./features/dev/theme-preview/theme-preview').then((m) => m.ThemePreview),
  },
  {
    path: 'dev/api',
    loadComponent: () =>
      import('./features/dev/api-playground/api-playground').then((m) => m.ApiPlayground),
  },
];
