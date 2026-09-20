import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { ClerkService } from 'ngx-clerk';
import { firstValueFrom } from 'rxjs';
import { MeApi } from '../api/me.api';
import { ROLE_HOME, Role, SIGN_IN_PATH, parseRole } from './roles';

/** Estado de sesión, rol y perfil del usuario, sobre las señales de Clerk. */
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
      user.fullName?.trim() || [user.firstName, user.lastName].filter(Boolean).join(' ').trim() || null
    );
  });

  /** Nombre para mostrar: el de Clerk o, si no hay, el correo. */
  readonly fullName = computed(() => (this.user() ? (this.clerkName() ?? this.email()) : null));

  /** `null` sin sesión. */
  readonly role = computed<Role | null>(() =>
    this.isSignedIn() ? parseRole(this.user()?.publicMetadata?.['role']) : null,
  );

  /** Inicio del usuario según su rol, o la pantalla de inicio de sesión si no hay sesión. */
  readonly home = computed(() => {
    const role = this.role();
    return role ? ROLE_HOME[role] : SIGN_IN_PATH;
  });

  // Perfil resuelto para un correo concreto; se descarta si cambia la cuenta.
  private readonly profile = signal<{ email: string; complete: boolean } | null>(null);

  readonly profileComplete = computed(() => {
    const p = this.profile();
    return p && p.email === this.email() ? p.complete : null;
  });

  /**
   * Devuelve si el perfil está completo. Solo consulta al backend cuando aún no se sabe
   * (o si `force`); un error del backend se propaga para que el guard decida.
   */
  async loadProfile(force = false): Promise<boolean> {
    const known = this.profileComplete();
    if (known !== null && !force) return known;
    const me = await firstValueFrom(this.meApi.getMe());
    this.profile.set({ email: me.email, complete: me.profile_complete });
    return me.profile_complete;
  }

  // DNI guardado en esta sesión (Clerk tarda en reflejar `unsafeMetadata` en el objeto usuario).
  private readonly savedDni = signal<{ email: string; dni: string } | null>(null);

  /**
   * DNI del cliente, guardado en `unsafeMetadata.dni` de Clerk. Interino hasta que exista
   * `GET /me` (B2), que lo devolverá desde el backend. `null` si aún no se conoce.
   */
  readonly dni = computed<string | null>(() => {
    const saved = this.savedDni();
    if (saved && saved.email === this.email()) return saved.dni;
    const value = this.user()?.unsafeMetadata?.['dni'];
    return typeof value === 'string' && /^\d{8}$/.test(value.trim()) ? value.trim() : null;
  });

  /** Guarda el DNI en Clerk. Queda disponible al instante en `dni()`; un fallo de Clerk se propaga. */
  async saveDni(dni: string): Promise<void> {
    const user = this.user();
    const email = this.email();
    if (!user || !email) return;
    const clean = dni.trim();
    this.savedDni.set({ email, dni: clean });
    await user.update({ unsafeMetadata: { ...(user.unsafeMetadata ?? {}), dni: clean } });
  }

  /** Marca el perfil como completo tras el onboarding. */
  markProfileComplete(): void {
    const email = this.email();
    if (email) this.profile.set({ email, complete: true });
  }

  /** Guarda el nombre en Clerk si la cuenta aún no tiene uno (mejor esfuerzo: un fallo no bloquea). */
  async syncClerkName(name: string): Promise<void> {
    const user = this.user();
    if (!user || this.clerkName()) return;
    const [firstName, ...rest] = name.trim().split(/\s+/);
    try {
      await user.update({ firstName, lastName: rest.join(' ') || undefined });
    } catch {
      // El nombre ya quedó registrado en el backend; Clerk se sincroniza en otra ocasión.
    }
  }

  async signOut(): Promise<void> {
    await this.clerk.signOut();
    this.profile.set(null);
    this.savedDni.set(null);
    await this.router.navigateByUrl(SIGN_IN_PATH);
  }
}
