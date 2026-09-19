import { Injectable, inject } from '@angular/core';
import { ClerkService } from 'ngx-clerk';
import { Observable, catchError, map, of, switchMap, throwError } from 'rxjs';
import { parseRole } from '../auth/roles';
import { ApiError } from '../http/api-error';
import { Me, OnboardingInput } from '../models';
import { CustomersApi } from './customers.api';
import { IdentityApi } from './identity.api';

/**
 * Perfil del usuario autenticado.
 *
 * Implementación INTERINA: el backend todavía no tiene `GET /me` ni `POST /me/onboarding`
 * (B2 del plan), así que se compone con los endpoints que ya existen y el rol sale de
 * `public_metadata.role` de Clerk. Cuando exista B2 solo hay que reemplazar el cuerpo de
 * `getMe()` y `completeOnboarding()`; el resto de la app no cambia.
 */
@Injectable({ providedIn: 'root' })
export class MeApi {
  private readonly clerk = inject(ClerkService);
  private readonly customers = inject(CustomersApi);
  private readonly identity = inject(IdentityApi);

  /** Rol y estado del perfil del usuario con sesión activa. */
  getMe(): Observable<Me> {
    const user = this.clerk.user();
    const email = user?.primaryEmailAddress?.emailAddress?.toLowerCase() ?? '';
    const role = parseRole(user?.publicMetadata?.['role']);

    // Entrenador y admin no pasan por el onboarding de cliente.
    if (role !== 'cliente') return of({ email, role, profile_complete: true });

    return this.customers.getByEmail(email).pipe(
      map(() => true),
      catchError((err) => (notFound(err) ? of(false) : throwError(() => err))),
      map((profile_complete) => ({ email, role, profile_complete })),
    );
  }

  /**
   * Crea el cliente y vincula su DNI. El vínculo se hace ANTES de crear el cliente: así,
   * "existe el cliente" implica "el DNI ya está vinculado" y un fallo a medias se reintenta.
   */
  completeOnboarding(input: OnboardingInput): Observable<void> {
    const email = input.email.trim().toLowerCase();
    const dni = input.dni.trim();

    return this.identity.resolve(dni).pipe(
      map((link) => link.email.toLowerCase()),
      catchError((err) => (notFound(err) ? of(null) : throwError(() => err))),
      switchMap((linkedTo) =>
        // El backend real sobrescribe el vínculo sin avisar: se valida aquí para no
        // "robar" el DNI de otra cuenta.
        linkedTo && linkedTo !== email ? throwError(() => dniTakenError()) : of(linkedTo),
      ),
      switchMap((linkedTo) =>
        linkedTo ? of(undefined) : this.identity.linkCustomer({ dni, email }).pipe(map(() => undefined)),
      ),
      switchMap(() =>
        this.customers.getByEmail(email).pipe(
          map(() => true),
          catchError((err) => (notFound(err) ? of(false) : throwError(() => err))),
        ),
      ),
      switchMap((exists) =>
        exists
          ? of(undefined)
          : this.customers
              .create({ email, name: input.name.trim(), age: input.age })
              .pipe(map(() => undefined)),
      ),
    );
  }
}

const notFound = (err: unknown): boolean => err instanceof ApiError && err.isNotFound;

const DNI_TAKEN_MESSAGE = 'Este DNI ya está vinculado a otra cuenta.';

function dniTakenError(): ApiError {
  return new ApiError(409, 'DNI_TAKEN', DNI_TAKEN_MESSAGE, { dni: DNI_TAKEN_MESSAGE });
}
