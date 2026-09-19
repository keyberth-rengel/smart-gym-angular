import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./features/dev/theme-preview/theme-preview').then((m) => m.ThemePreview),
  },
];
