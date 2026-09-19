import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, CanActivateFn, Router, RouterStateSnapshot, UrlTree } from '@angular/router';
import { of, throwError } from 'rxjs';
import { ToastService } from '../../shared/ui/toast/toast.service';
import { FakeClerk, createFakeClerk, fakeUser, provideFakeClerk } from '../../testing/fake-clerk';
import { MeApi } from '../api/me.api';
import { Me } from '../models';
import { authGuard, guestGuard, homeGuard, onboardingGuard, profileCompleteGuard, roleGuard } from './guards';
import { provideRouter } from '@angular/router';

describe('guards', () => {
  let clerk: FakeClerk;
  let getMe: ReturnType<typeof vi.fn>;
  let router: Router;

  function setup(options: { role?: unknown; signedIn?: boolean; loaded?: boolean; profile?: boolean | 'error' } = {}) {
    clerk = createFakeClerk({
      loaded: options.loaded ?? true,
      user: options.signedIn === false ? null : fakeUser({ role: options.role }),
    });
    getMe = vi.fn(() =>
      options.profile === 'error'
        ? throwError(() => new Error('backend caído'))
        : of({ email: 'ana@correo.com', role: 'cliente', profile_complete: options.profile ?? true } as Me),
    );
    TestBed.configureTestingModule({
      providers: [provideRouter([]), provideFakeClerk(clerk), { provide: MeApi, useValue: { getMe } }],
    });
    router = TestBed.inject(Router);
  }

  /** Ejecuta el guard y devuelve `true` o la URL destino. */
  async function run(guard: CanActivateFn): Promise<true | string | false> {
    const result = await TestBed.runInInjectionContext(
      () => guard({} as ActivatedRouteSnapshot, { url: '/x' } as RouterStateSnapshot),
    );
    if (result === true || result === false) return result;
    return router.serializeUrl(result as UrlTree);
  }

  describe('authGuard', () => {
    it('sin sesión va al inicio de sesión', async () => {
      setup({ signedIn: false });
      expect(await run(authGuard)).toBe('/auth/sign-in');
    });

    it('con sesión deja pasar', async () => {
      setup();
      expect(await run(authGuard)).toBe(true);
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

    it('cargando y sin sesión: al terminar redirige al inicio de sesión', async () => {
      setup({ loaded: false, signedIn: false });
      const pending = run(authGuard);
      TestBed.tick();
      clerk.isLoaded.set(true);
      TestBed.tick();
      expect(await pending).toBe('/auth/sign-in');
    });
  });

  describe('guestGuard', () => {
    it('sin sesión deja ver el acceso', async () => {
      setup({ signedIn: false });
      expect(await run(guestGuard)).toBe(true);
    });

    it.each([
      [undefined, '/cliente'],
      ['entrenador', '/entrenador'],
      ['admin', '/admin'],
    ])('con sesión (%s) va a %s', async (role, home) => {
      setup({ role });
      expect(await run(guestGuard)).toBe(home);
    });
  });

  describe('homeGuard', () => {
    it('sin sesión va al inicio de sesión', async () => {
      setup({ signedIn: false });
      expect(await run(homeGuard)).toBe('/auth/sign-in');
    });

    it('con sesión va al inicio del rol', async () => {
      setup({ role: 'entrenador' });
      expect(await run(homeGuard)).toBe('/entrenador');
    });
  });

  describe('roleGuard', () => {
    it('rol permitido', async () => {
      setup({ role: 'admin' });
      expect(await run(roleGuard(['admin']))).toBe(true);
    });

    it('rol permitido entre varios', async () => {
      setup({ role: 'entrenador' });
      expect(await run(roleGuard(['cliente', 'entrenador']))).toBe(true);
    });

    it('rol no permitido vuelve a su inicio y avisa con un toast', async () => {
      setup({ role: undefined });
      expect(await run(roleGuard(['admin']))).toBe('/cliente');
      const toasts = TestBed.inject(ToastService).toasts();
      expect(toasts).toHaveLength(1);
      expect(toasts[0].kind).toBe('warning');
      expect(toasts[0].message).toBe('No tienes permisos para acceder a esa sección.');
    });

    it('un admin que entra a una ruta de cliente vuelve a /admin', async () => {
      setup({ role: 'admin' });
      expect(await run(roleGuard(['cliente']))).toBe('/admin');
    });

    it('sin sesión va al inicio de sesión, sin toast', async () => {
      setup({ signedIn: false });
      expect(await run(roleGuard(['admin']))).toBe('/auth/sign-in');
      expect(TestBed.inject(ToastService).toasts()).toHaveLength(0);
    });
  });

  describe('profileCompleteGuard', () => {
    it('cliente con perfil completo pasa', async () => {
      setup({ profile: true });
      expect(await run(profileCompleteGuard)).toBe(true);
    });

    it('cliente sin perfil va al onboarding', async () => {
      setup({ profile: false });
      expect(await run(profileCompleteGuard)).toBe('/auth/onboarding');
    });

    it('si el backend falla va a "no pudimos cargar tu perfil"', async () => {
      setup({ profile: 'error' });
      expect(await run(profileCompleteGuard)).toBe('/auth/unavailable');
    });

    it.each(['entrenador', 'admin'])('%s no consulta el perfil', async (role) => {
      setup({ role, profile: false });
      expect(await run(profileCompleteGuard)).toBe(true);
      expect(getMe).not.toHaveBeenCalled();
    });

    it('reutiliza el perfil ya conocido', async () => {
      setup({ profile: true });
      await run(profileCompleteGuard);
      await run(profileCompleteGuard);
      expect(getMe).toHaveBeenCalledTimes(1);
    });

    it('espera a que Clerk cargue', async () => {
      setup({ loaded: false, profile: true });
      const pending = run(profileCompleteGuard);
      TestBed.tick();
      clerk.isLoaded.set(true);
      TestBed.tick();
      expect(await pending).toBe(true);
    });
  });

  describe('onboardingGuard', () => {
    it('cliente con perfil pendiente entra', async () => {
      setup({ profile: false });
      expect(await run(onboardingGuard)).toBe(true);
    });

    it('cliente con perfil completo va a su inicio', async () => {
      setup({ profile: true });
      expect(await run(onboardingGuard)).toBe('/cliente');
    });

    it.each([
      ['entrenador', '/entrenador'],
      ['admin', '/admin'],
    ])('%s va a su inicio sin consultar el perfil', async (role, home) => {
      setup({ role });
      expect(await run(onboardingGuard)).toBe(home);
      expect(getMe).not.toHaveBeenCalled();
    });

    it('si el backend falla va a "no pudimos cargar tu perfil"', async () => {
      setup({ profile: 'error' });
      expect(await run(onboardingGuard)).toBe('/auth/unavailable');
    });
  });
});
