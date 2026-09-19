import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { MeApi } from '../api/me.api';
import { Me } from '../models';
import { FakeClerk, createFakeClerk, fakeUser, provideFakeClerk } from '../../testing/fake-clerk';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  let clerk: FakeClerk;
  let getMe: ReturnType<typeof vi.fn>;

  function setup(user = fakeUser()) {
    clerk = createFakeClerk({ user });
    getMe = vi.fn(
      (): ReturnType<MeApi['getMe']> =>
        of({ email: clerk.user()!.primaryEmailAddress!.emailAddress.toLowerCase(), role: 'cliente', profile_complete: false } as Me),
    );
    TestBed.configureTestingModule({
      providers: [provideRouter([]), provideFakeClerk(clerk), { provide: MeApi, useValue: { getMe } }],
    });
    return TestBed.inject(AuthService);
  }

  describe('rol y home', () => {
    it('sin metadata es cliente', () => {
      const auth = setup(fakeUser());
      expect(auth.role()).toBe('cliente');
      expect(auth.home()).toBe('/cliente');
    });

    it.each([
      ['entrenador', '/entrenador'],
      ['admin', '/admin'],
      ['cliente', '/cliente'],
    ])('rol %s -> %s', (role, home) => {
      const auth = setup(fakeUser({ role }));
      expect(auth.role()).toBe(role);
      expect(auth.home()).toBe(home);
    });

    it('metadata con un valor desconocido cae en cliente', () => {
      expect(setup(fakeUser({ role: 'root' })).role()).toBe('cliente');
    });

    it('sin sesión: rol null y home en el inicio de sesión', () => {
      const auth = setup();
      clerk.user.set(null);
      expect(auth.isSignedIn()).toBe(false);
      expect(auth.role()).toBeNull();
      expect(auth.home()).toBe('/auth/sign-in');
    });
  });

  describe('datos del usuario', () => {
    it('normaliza el correo a minúsculas', () => {
      expect(setup(fakeUser({ email: 'ANA@Correo.COM' })).email()).toBe('ana@correo.com');
    });

    it('usa el nombre completo; si falta, nombre y apellido; si no, el correo', () => {
      const auth = setup(fakeUser({ name: 'Ana Pérez' }));
      expect(auth.fullName()).toBe('Ana Pérez');

      clerk.user.set({ ...fakeUser(), fullName: null, firstName: 'Ana', lastName: 'Ruiz' });
      expect(auth.fullName()).toBe('Ana Ruiz');

      clerk.user.set({ ...fakeUser(), fullName: null, firstName: null, lastName: null });
      expect(auth.fullName()).toBe('ana@correo.com');
    });
  });

  describe('syncClerkName', () => {
    it('sin nombre en Clerk lo guarda separando nombre y apellidos', async () => {
      const user = fakeUser({ name: null });
      const auth = setup(user);
      expect(auth.clerkName()).toBeNull();
      await auth.syncClerkName('  Luis  Ramírez Soto ');
      expect(user.updates).toEqual([{ firstName: 'Luis', lastName: 'Ramírez Soto' }]);
    });

    it('una sola palabra: solo nombre', async () => {
      const user = fakeUser({ name: null });
      await setup(user).syncClerkName('Luis');
      expect(user.updates).toEqual([{ firstName: 'Luis', lastName: undefined }]);
    });

    it('si Clerk ya tiene nombre no lo pisa', async () => {
      const user = fakeUser({ name: 'Ana Pérez' });
      await setup(user).syncClerkName('Otro Nombre');
      expect(user.updates).toEqual([]);
    });

    it('si Clerk falla no lanza error', async () => {
      const user = fakeUser({ name: null });
      user.update = async () => {
        throw new Error('clerk caído');
      };
      await expect(setup(user).syncClerkName('Luis Ramírez')).resolves.toBeUndefined();
    });
  });

  describe('perfil', () => {
    it('consulta una vez y reutiliza el resultado', async () => {
      const auth = setup();
      expect(auth.profileComplete()).toBeNull();
      expect(await auth.loadProfile()).toBe(false);
      expect(await auth.loadProfile()).toBe(false);
      expect(getMe).toHaveBeenCalledTimes(1);
      expect(auth.profileComplete()).toBe(false);
    });

    it('force vuelve a consultar', async () => {
      const auth = setup();
      await auth.loadProfile();
      await auth.loadProfile(true);
      expect(getMe).toHaveBeenCalledTimes(2);
    });

    it('markProfileComplete lo deja completo sin llamar al backend', async () => {
      const auth = setup();
      auth.markProfileComplete();
      expect(auth.profileComplete()).toBe(true);
      expect(await auth.loadProfile()).toBe(true);
      expect(getMe).not.toHaveBeenCalled();
    });

    it('descarta el perfil si cambia de cuenta', async () => {
      const auth = setup(fakeUser({ email: 'uno@correo.com' }));
      auth.markProfileComplete();
      clerk.user.set(fakeUser({ email: 'otro@correo.com' }));
      expect(auth.profileComplete()).toBeNull();
    });

    it('un error del backend se propaga', async () => {
      const auth = setup();
      getMe.mockImplementation(() => {
        throw new Error('caído');
      });
      await expect(auth.loadProfile()).rejects.toThrow('caído');
    });
  });

  it('signOut cierra la sesión, olvida el perfil y va al inicio de sesión', async () => {
    const auth = setup();
    const router = TestBed.inject(Router);
    const navigate = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
    auth.markProfileComplete();

    await auth.signOut();

    expect(clerk.signOutCalls).toBe(1);
    expect(auth.profileComplete()).toBeNull();
    expect(navigate).toHaveBeenCalledWith('/auth/sign-in');
  });
});
