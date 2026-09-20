import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { ClerkService } from 'ngx-clerk';
import { firstValueFrom } from 'rxjs';
import { MeApi } from '../api/me.api';
import { ApiError } from '../http/api-error';
import { Me } from '../models';
import { ROLE_HOME, Role, SIGN_IN_PATH, parseRole } from './roles';

/**
 * Por qué no se pudo resolver el perfil (`GET /me`):
 * - `unauthorized`: el backend rechazó el token (401); hay que volver a iniciar sesión.
 * - `forbidden`: el token no trae el correo (403); la sesión de Clerk no está bien configurada.
 * - `network` / `server`: sin respuesta del backend o error 5xx.
 * - `profile-pending`: entrenador cuyo perfil aún no fue registrado por el administrador.
 * - `clerk`: el servicio de acceso (Clerk) no llegó a cargar en el navegador.
 */
export type MeErrorKind =
  'unauthorized' | 'forbidden' | 'network' | 'server' | 'profile-pending' | 'clerk';

function classify(err: unknown): MeErrorKind {
  if (err instanceof ApiError) {
    if (err.status === 401) return 'unauthorized';
    if (err.status === 403) return 'forbidden';
    if (err.isNetwork) return 'network';
  }
  return 'server';
}

/** Estado de sesión (Clerk) y perfil del usuario (backend `GET /me`): rol, nombre y DNI. */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly clerk = inject(ClerkService);
  private readonly meApi = inject(MeApi);
  private readonly router = inject(Router);

  readonly isLoaded = this.clerk.isLoaded;
  readonly isSignedIn = this.clerk.isSignedIn;
  readonly user = this.clerk.user;

  readonly email = computed(
    () => this.user()?.primaryEmailAddress?.emailAddress?.toLowerCase() ?? null,
  );

  /** Nombre que Clerk tiene registrado, o `null` si la cuenta no lo tiene (registro solo con correo). */
  readonly clerkName = computed(() => {
    const user = this.user();
    if (!user) return null;
    return (
      user.fullName?.trim() ||
      [user.firstName, user.lastName].filter(Boolean).join(' ').trim() ||
      null
    );
  });

  // Perfil del backend para un correo concreto; se descarta si cambia la cuenta.
  private readonly state = signal<{ email: string; me: Me } | null>(null);

  /** Perfil cargado para la cuenta actual, o `null` si aún no se ha resuelto. */
  readonly me = computed<Me | null>(() => {
    const s = this.state();
    return s && s.email === this.email() ? s.me : null;
  });

  /** Motivo del último fallo al cargar el perfil (lo muestra la pantalla "no disponible"). */
  readonly meError = signal<MeErrorKind | null>(null);

  /** `null` sin sesión o mientras no se haya cargado el perfil. */
  readonly role = computed<Role | null>(() => {
    const me = this.me();
    return this.isSignedIn() && me ? parseRole(me.role) : null;
  });

  /** Inicio del usuario según su rol, o la pantalla de inicio de sesión si aún no hay rol. */
  readonly home = computed(() => {
    const role = this.role();
    return role ? ROLE_HOME[role] : SIGN_IN_PATH;
  });

  /** `null` mientras no se conozca el perfil. */
  readonly profileComplete = computed(() => this.me()?.profile_complete ?? null);

  /** DNI vinculado a la cuenta (lo devuelve el backend); `null` si aún no lo tiene. */
  readonly dni = computed(() => this.me()?.dni ?? null);

  /** Nombre para mostrar: el del backend, el de Clerk o, si no hay, el correo. */
  readonly fullName = computed(() =>
    this.user() ? this.me()?.name?.trim() || this.clerkName() || this.email() : null,
  );

  private inflight: { email: string; promise: Promise<Me> } | null = null;

  /**
   * Devuelve el perfil del backend. Solo lo consulta cuando aún no se conoce (o si `force`);
   * las llamadas simultáneas (varios guards) comparten una sola petición. Un fallo se
   * propaga y deja el motivo en `meError`.
   */
  async loadMe(force = false): Promise<Me> {
    const email = this.email();
    if (!email) throw new Error('Sin sesión');
    const known = this.me();
    if (known && !force) return known;
    if (this.inflight?.email === email) return this.inflight.promise;

    const promise = this.fetchMe(email).finally(() => {
      if (this.inflight?.promise === promise) this.inflight = null;
    });
    this.inflight = { email, promise };
    return promise;
  }

  private async fetchMe(email: string): Promise<Me> {
    try {
      const me = await firstValueFrom(this.meApi.getMe());
      this.setMe(email, me);
      this.meError.set(null);
      return me;
    } catch (err) {
      this.state.set(null);
      this.meError.set(classify(err));
      throw err;
    }
  }

  /** Guarda el perfil devuelto por el backend (por ejemplo, tras el onboarding). */
  applyMe(me: Me): void {
    const email = this.email();
    if (!email) return;
    this.setMe(email, me);
    this.meError.set(null);
  }

  /** Marca que un entrenador aún no tiene perfil registrado (lo muestra "no disponible"). */
  markProfilePending(): void {
    this.meError.set('profile-pending');
  }

  /** Marca que Clerk no cargó a tiempo (lo muestra "no disponible", que recarga la página). */
  markClerkUnavailable(): void {
    this.meError.set('clerk');
  }

  private setMe(email: string, me: Me): void {
    this.state.set({ email, me });
  }

  async signOut(): Promise<void> {
    await this.clerk.signOut();
    this.reset();
    await this.router.navigateByUrl(SIGN_IN_PATH);
  }

  /** Cierra la sesión sin navegar (lo usan los guards cuando el backend rechaza el token). */
  async expireSession(): Promise<void> {
    await this.clerk.signOut();
    this.reset();
  }

  private reset(): void {
    this.state.set(null);
    this.meError.set(null);
    this.inflight = null;
  }
}
