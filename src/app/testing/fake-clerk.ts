import { Provider, computed, signal } from '@angular/core';
import { ClerkService } from 'ngx-clerk';

/** Usuario mínimo de Clerk para pruebas. */
export interface FakeUser {
  fullName: string | null;
  firstName: string | null;
  lastName: string | null;
  primaryEmailAddress: { emailAddress: string } | null;
  publicMetadata: Record<string, unknown>;
  unsafeMetadata: Record<string, unknown>;
  updates: unknown[];
  update(params: unknown): Promise<void>;
}

export function fakeUser(
  options: { role?: unknown; email?: string; name?: string | null; dni?: string } = {},
): FakeUser {
  const name = options.name === undefined ? 'Ana Pérez' : options.name;
  const [first = null, ...rest] = name ? name.split(' ') : [];
  return {
    fullName: name,
    firstName: first,
    lastName: rest.join(' ') || null,
    primaryEmailAddress: { emailAddress: options.email ?? 'Ana@Correo.com' },
    publicMetadata: options.role === undefined ? {} : { role: options.role },
    unsafeMetadata: options.dni === undefined ? {} : { dni: options.dni },
    updates: [],
    async update(params: unknown) {
      this.updates.push(params);
    },
  };
}

/** Sustituto de `ClerkService` con las señales y métodos que usa la app. */
export function createFakeClerk(initial: { loaded?: boolean; user?: FakeUser | null } = {}) {
  const isLoaded = signal(initial.loaded ?? true);
  const user = signal<FakeUser | null>(initial.user ?? null);
  const isSignedIn = computed(() => user() !== null);

  const fake = {
    isLoaded,
    user,
    isSignedIn,
    token: 'jwt-de-prueba' as string | null,
    getTokenCalls: 0,
    signOutCalls: 0,
    async getToken(): Promise<string | null> {
      fake.getTokenCalls++;
      return fake.token;
    },
    async signOut(): Promise<void> {
      fake.signOutCalls++;
      user.set(null);
    },
  };
  return fake;
}

export type FakeClerk = ReturnType<typeof createFakeClerk>;

export const provideFakeClerk = (fake: FakeClerk): Provider => ({
  provide: ClerkService,
  useValue: fake,
});
