import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { ClerkService } from 'ngx-clerk';
import { from, switchMap } from 'rxjs';
import { environment } from '../../../environments/environment';

/** Agrega `Authorization: Bearer <JWT de Clerk>` a las peticiones al API cuando hay sesión. */
export const authTokenInterceptor: HttpInterceptorFn = (req, next) => {
  if (!req.url.startsWith(environment.apiBase)) return next(req);

  const clerk = inject(ClerkService);
  if (!clerk.isSignedIn()) return next(req);

  return from(clerk.getToken()).pipe(
    switchMap((token) =>
      next(token ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : req),
    ),
  );
};
