import { TestBed } from '@angular/core/testing';
import {
  ActivatedRouteSnapshot,
  CanActivateFn,
  Router,
  RouterStateSnapshot,
  UrlTree,
  provideRouter,
} from '@angular/router';
import { of, throwError } from 'rxjs';
import { ToastService } from '../../shared/ui/toast/toast.service';
import { FakeClerk, createFakeClerk, fakeUser, provideFakeClerk } from '../../testing/fake-clerk';
import { MeApi } from '../api/me.api';
import { ApiError } from '../http/api-error';
import { Me } from '../models';
import { AuthService } from './auth.service';
import {
  CLERK_LOAD_TIMEOUT_MS,
  authGuard,
  guestGuard,
  homeGuard,
  onboardingGuard,
  profileCompleteGuard,
  roleGuard,
} from './guards';

const me = (over: Partial<Me> = {}): Me => ({
  role: 'cliente',
  email: 'ana@correo.com',
  name: 'Ana Pérez',
  dni: '12345678',
  profile_complete: true,
  profile: { email: 'ana@correo.com', name: 'Ana Pérez', age: 28 },
  ...over,
});

describe('guards', () => {
  let clerk: FakeClerk;
  let getMe: ReturnType<typeof vi.fn>;
  let router: Router;

  interface Options {
    me?: Partial<Me>;
    signedIn?: boolean;
    loaded?: boolean;
    error?: ApiError | Error;
  }

  function setup(options: Options = {}) {
    clerk = createFakeClerk({
      loaded: options.loaded ?? true,
      user: options.signedIn === false ? null : fakeUser(),
    });
    getMe = vi.fn(() => (options.error ? throwError(() => options.error) : of(me(options.me))));
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideFakeClerk(clerk),
        { provide: MeApi, useValue: { getMe } },
      ],
    });
    router = TestBed.inject(Router);
  }

  /** Ejecuta el guard y devuelve `true` o la URL destino. */
  async function run(guard: CanActivateFn): Promise<true | string | false> {
    const result = await TestBed.runInInjectionContext(() =>
      guard({} as ActivatedRouteSnapshot, { url: '/x' } as RouterStateSnapshot),
    );
    if (result === true || result === false) return result;
    return router.serializeUrl(result as UrlTree);
  }

  describe('authGuard', () => {
    it('sin sesión va al inicio de sesión', async () => {
      setup({ signedIn: false });
      expect(await run(authGuard)).toBe('/auth/sign-in');
    });

    it('con sesión deja pasar sin consultar /me', async () => {
      setup();
      expect(await run(authGuard)).toBe(true);
      expect(getMe).not.toHaveBeenCalled();
    });

    it('espera a que Clerk termine de cargar', async () => {
      setup({ loaded: false });
      let settled: unknown = 'pendiente';
      const pending = run(authGuard).then((r) => (settled = r));
      await Promise.resolve();
      TestBed.tick();
      expect(settled).toBe('pendiente');
      clerk.isLoaded.set(true);
      TestBed.tick();
      await pending;
      expect(settled).toBe(true);
    });

    describe('si Clerk no llega a cargar', () => {
      beforeEach(() => vi.useFakeTimers());
      afterEach(() => vi.useRealTimers());

      it('tras el tiempo máximo va a "no disponible" con el motivo clerk (sin dejar la app en blanco)', async () => {
        setup({ loaded: false });
        const pending = run(authGuard);
        await vi.advanceTimersByTimeAsync(CLERK_LOAD_TIMEOUT_MS - 1);
        expect(TestBed.inject(AuthService).meError()).toBeNull();
        await vi.advanceTimersByTimeAsync(2);
        expect(await pending).toBe('/auth/unavailable');
        expect(TestBed.inject(AuthService).meError()).toBe('clerk');
      });

      it.each([
        ['guestGuard', guestGuard],
        ['homeGuard', homeGuard],
        ['profileCompleteGuard', profileCompleteGuard],
        ['onboardingGuard', onboardingGuard],
        ['roleGuard', roleGuard(['cliente'])],
      ] as const)('%s también lleva a "no disponible"', async (_name, guard) => {
        setup({ loaded: false });
        const pending = run(guard);
        await vi.advanceTimersByTimeAsync(CLERK_LOAD_TIMEOUT_MS + 1);
        expect(await pending).toBe('/auth/unavailable');
        expect(getMe).not.toHaveBeenCalled();
      });

      it('si Clerk carga antes del límite se comporta como siempre y no queda nada pendiente', async () => {
        setup({ loaded: false });
        const pending = run(authGuard);
        await vi.advanceTimersByTimeAsync(1000);
        clerk.isLoaded.set(true);
        TestBed.tick();
        expect(await pending).toBe(true);
        await vi.advanceTimersByTimeAsync(CLERK_LOAD_TIMEOUT_MS * 2);
        expect(TestBed.inject(AuthService).meError()).toBeNull();
      });
    });
  });

  describe('guestGuard', () => {
    it('sin sesión deja ver las páginas de acceso', async () => {
      setup({ signedIn: false });
      expect(await run(guestGuard)).toBe(true);
      expect(getMe).not.toHaveBeenCalled();
    });

    it.each([
      ['cliente', '/cliente'],
      ['entrenador', '/entrenador'],
      ['admin', '/admin'],
    ])('con sesión de %s va a %s (rol de /me)', async (role, home) => {
      setup({ me: { role: role as Me['role'] } });
      expect(await run(guestGuard)).toBe(home);
    });

    it('si /me falla va a "no disponible"', async () => {
      setup({ error: new ApiError(500, 'X', 'x') });
      expect(await run(guestGuard)).toBe('/auth/unavailable');
    });
  });

  describe('homeGuard', () => {
    it('sin sesión -> inicio de sesión', async () => {
      setup({ signedIn: false });
      expect(await run(homeGuard)).toBe('/auth/sign-in');
    });

    it.each([
      ['cliente', '/cliente'],
      ['entrenador', '/entrenador'],
      ['admin', '/admin'],
    ])('%s -> %s', async (role, home) => {
      setup({ me: { role: role as Me['role'] } });
      expect(await run(homeGuard)).toBe(home);
    });

    it('entrenador sin perfil registrado -> "no disponible" con el motivo pendiente', async () => {
      setup({ me: { role: 'entrenador', profile_complete: false, profile: null } });
      expect(await run(homeGuard)).toBe('/auth/unavailable');
      expect(TestBed.inject(AuthService).meError()).toBe('profile-pending');
    });

    it('/me con 401 cierra la sesión y va al inicio de sesión', async () => {
      setup({ error: new ApiError(401, 'UNAUTHORIZED', 'Unauthorized') });
      expect(await run(homeGuard)).toBe('/auth/sign-in');
      expect(clerk.signOutCalls).toBe(1);
    });

    it.each([
      [403, 'forbidden'],
      [500, 'server'],
      [0, 'network'],
    ])('/me con %i -> "no disponible" (%s) sin cerrar la sesión', async (status, kind) => {
      setup({ error: new ApiError(status, 'X', 'x') });
      expect(await run(homeGuard)).toBe('/auth/unavailable');
      expect(TestBed.inject(AuthService).meError()).toBe(kind);
      expect(clerk.signOutCalls).toBe(0);
    });
  });

  describe('roleGuard', () => {
    it('sin sesión va al inicio de sesión', async () => {
      setup({ signedIn: false });
      expect(await run(roleGuard(['cliente']))).toBe('/auth/sign-in');
    });

    it('rol permitido pasa', async () => {
      setup({ me: { role: 'entrenador' } });
      expect(await run(roleGuard(['entrenador']))).toBe(true);
    });

    it('acepta varios roles', async () => {
      setup({ me: { role: 'admin' } });
      expect(await run(roleGuard(['entrenador', 'admin']))).toBe(true);
    });

    it.each([
      ['cliente', ['admin'], '/cliente'],
      ['cliente', ['entrenador'], '/cliente'],
      ['entrenador', ['admin'], '/entrenador'],
      ['admin', ['cliente'], '/admin'],
    ])('%s en una ruta de %j vuelve a %s con aviso', async (role, allowed, home) => {
      setup({ me: { role: role as Me['role'] } });
      const toast = TestBed.inject(ToastService);
      expect(await run(roleGuard(allowed as ('cliente' | 'entrenador' | 'admin')[]))).toBe(home);
      expect(toast.toasts().map((t) => t.message)).toEqual([
        'No tienes permisos para acceder a esa sección.',
      ]);
    });

    it('rol permitido no muestra aviso', async () => {
      setup();
      await run(roleGuard(['cliente']));
      expect(TestBed.inject(ToastService).toasts()).toEqual([]);
    });

    it('/me caído lleva a "no disponible" y no da acceso', async () => {
      setup({ error: new ApiError(500, 'X', 'x') });
      expect(await run(roleGuard(['cliente']))).toBe('/auth/unavailable');
    });

    it('/me con 401 cierra la sesión', async () => {
      setup({ error: new ApiError(401, 'X', 'x') });
      expect(await run(roleGuard(['admin']))).toBe('/auth/sign-in');
      expect(clerk.signOutCalls).toBe(1);
    });

    it('el rol de Clerk (public_metadata) no da acceso: manda /me', async () => {
      setup({ me: { role: 'cliente' } });
      clerk.user.set(fakeUser({ role: 'admin' }));
      expect(await run(roleGuard(['admin']))).toBe('/cliente');
    });
  });

  describe('profileCompleteGuard', () => {
    it('cliente con perfil completo pasa', async () => {
      setup();
      expect(await run(profileCompleteGuard)).toBe(true);
    });

    it('cliente sin perfil va al onboarding', async () => {
      setup({ me: { profile_complete: false, dni: null, profile: null } });
      expect(await run(profileCompleteGuard)).toBe('/auth/onboarding');
    });

    it('admin pasa siempre', async () => {
      setup({ me: { role: 'admin', profile: null } });
      expect(await run(profileCompleteGuard)).toBe(true);
    });

    it('entrenador con perfil pasa', async () => {
      setup({ me: { role: 'entrenador' } });
      expect(await run(profileCompleteGuard)).toBe(true);
    });

    it('entrenador sin perfil registrado va a "no disponible"', async () => {
      setup({ me: { role: 'entrenador', profile_complete: false, profile: null } });
      expect(await run(profileCompleteGuard)).toBe('/auth/unavailable');
      expect(TestBed.inject(AuthService).meError()).toBe('profile-pending');
    });

    it('sin sesión -> inicio de sesión', async () => {
      setup({ signedIn: false });
      expect(await run(profileCompleteGuard)).toBe('/auth/sign-in');
    });

    it('/me caído -> "no disponible"', async () => {
      setup({ error: new ApiError(0, 'NETWORK_ERROR', 'x') });
      expect(await run(profileCompleteGuard)).toBe('/auth/unavailable');
    });

    it('no vuelve a consultar /me si ya está cargado', async () => {
      setup();
      await run(roleGuard(['cliente']));
      await run(profileCompleteGuard);
      expect(getMe).toHaveBeenCalledTimes(1);
    });
  });

  describe('onboardingGuard', () => {
    it('cliente sin perfil puede completar el onboarding', async () => {
      setup({ me: { profile_complete: false, dni: null, profile: null } });
      expect(await run(onboardingGuard)).toBe(true);
    });

    it('cliente con perfil completo va a su inicio', async () => {
      setup();
      expect(await run(onboardingGuard)).toBe('/cliente');
    });

    it.each([
      ['entrenador', '/entrenador'],
      ['admin', '/admin'],
    ])('%s no hace onboarding: va a %s', async (role, home) => {
      setup({ me: { role: role as Me['role'], profile_complete: false } });
      expect(await run(onboardingGuard)).toBe(home);
    });

    it('sin sesión -> inicio de sesión', async () => {
      setup({ signedIn: false });
      expect(await run(onboardingGuard)).toBe('/auth/sign-in');
    });

    it('/me caído -> "no disponible"', async () => {
      setup({ error: new ApiError(503, 'X', 'x') });
      expect(await run(onboardingGuard)).toBe('/auth/unavailable');
    });
  });

  it('ya no existen los guards interinos de DNI', async () => {
    const mod = await import('./guards');
    expect(Object.keys(mod)).not.toContain('dniGuard');
    expect(Object.keys(mod)).not.toContain('confirmDniGuard');
  });
});
