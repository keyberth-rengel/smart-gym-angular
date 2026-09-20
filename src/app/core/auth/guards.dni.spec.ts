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
import { createFakeClerk, fakeUser, provideFakeClerk } from '../../testing/fake-clerk';
import { MeApi } from '../api/me.api';
import { Me } from '../models';
import { confirmDniGuard, dniGuard } from './guards';

describe('guards de DNI', () => {
  let router: Router;

  function setup(options: { role?: unknown; dni?: string; profile?: boolean | 'error' } = {}) {
    const clerk = createFakeClerk({ user: fakeUser({ role: options.role, dni: options.dni, email: 'ana@correo.com' }) });
    const getMe = vi.fn(() =>
      options.profile === 'error'
        ? throwError(() => new Error('backend caído'))
        : of({ email: 'ana@correo.com', role: 'cliente', profile_complete: options.profile ?? true } as Me),
    );
    TestBed.configureTestingModule({
      providers: [provideRouter([]), provideFakeClerk(clerk), { provide: MeApi, useValue: { getMe } }],
    });
    router = TestBed.inject(Router);
  }

  async function run(guard: CanActivateFn): Promise<true | string> {
    const result = await TestBed.runInInjectionContext(() =>
      guard({} as ActivatedRouteSnapshot, { url: '/x' } as RouterStateSnapshot),
    );
    return result === true ? true : router.serializeUrl(result as UrlTree);
  }

  describe('dniGuard', () => {
    it('cliente sin DNI conocido va a confirmarlo', async () => {
      setup();
      expect(await run(dniGuard)).toBe('/auth/confirm-dni');
    });

    it('cliente con DNI pasa', async () => {
      setup({ dni: '12345678' });
      expect(await run(dniGuard)).toBe(true);
    });

    it.each(['entrenador', 'admin'])('%s no necesita DNI', async (role) => {
      setup({ role });
      expect(await run(dniGuard)).toBe(true);
    });
  });

  describe('confirmDniGuard', () => {
    it('cliente con perfil y sin DNI entra al paso', async () => {
      setup();
      expect(await run(confirmDniGuard)).toBe(true);
    });

    it('cliente que ya tiene DNI vuelve a su inicio', async () => {
      setup({ dni: '12345678' });
      expect(await run(confirmDniGuard)).toBe('/cliente');
    });

    it('cliente con el perfil pendiente va al onboarding', async () => {
      setup({ profile: false });
      expect(await run(confirmDniGuard)).toBe('/auth/onboarding');
    });

    it('si el backend falla va a "servicio no disponible"', async () => {
      setup({ profile: 'error' });
      expect(await run(confirmDniGuard)).toBe('/auth/unavailable');
    });

    it.each([
      ['entrenador', '/entrenador'],
      ['admin', '/admin'],
    ])('%s va a su propio inicio', async (role, home) => {
      setup({ role });
      expect(await run(confirmDniGuard)).toBe(home);
    });
  });
});
