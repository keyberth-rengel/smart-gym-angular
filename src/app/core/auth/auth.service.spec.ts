import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { Subject, of, throwError } from 'rxjs';
import { FakeClerk, createFakeClerk, fakeUser, provideFakeClerk } from '../../testing/fake-clerk';
import { MeApi } from '../api/me.api';
import { ApiError } from '../http/api-error';
import { Me } from '../models';
import { AuthService } from './auth.service';

const me = (over: Partial<Me> = {}): Me => ({
  role: 'cliente',
  email: 'ana@correo.com',
  name: 'Ana Pérez',
  dni: '12345678',
  profile_complete: true,
  profile: { email: 'ana@correo.com', name: 'Ana Pérez', age: 28 },
  ...over,
});

describe('AuthService', () => {
  let clerk: FakeClerk;
  let getMe: ReturnType<typeof vi.fn>;

  function setup(user = fakeUser(), result: () => ReturnType<MeApi['getMe']> = () => of(me())) {
    clerk = createFakeClerk({ user });
    getMe = vi.fn(result);
    TestBed.configureTestingModule({
      providers: [provideRouter([]), provideFakeClerk(clerk), { provide: MeApi, useValue: { getMe } }],
    });
    return TestBed.inject(AuthService);
  }

  describe('antes de cargar /me', () => {
    it('no hay rol ni perfil, y el inicio es el de sesión', () => {
      const auth = setup();
      expect(auth.role()).toBeNull();
      expect(auth.profileComplete()).toBeNull();
      expect(auth.dni()).toBeNull();
      expect(auth.home()).toBe('/auth/sign-in');
    });

    it('el rol de Clerk (public_metadata) se ignora: solo cuenta el del backend', () => {
      const auth = setup(fakeUser({ role: 'admin' }));
      expect(auth.role()).toBeNull();
    });
  });

  describe('rol y home desde /me', () => {
    it.each([
      ['cliente', '/cliente'],
      ['entrenador', '/entrenador'],
      ['admin', '/admin'],
    ])('rol %s -> %s', async (role, home) => {
      const auth = setup(fakeUser(), () => of(me({ role: role as Me['role'] })));
      await auth.loadMe();
      expect(auth.role()).toBe(role);
      expect(auth.home()).toBe(home);
    });

    it('un rol desconocido del backend cae en cliente', async () => {
      const auth = setup(fakeUser(), () => of(me({ role: 'root' as Me['role'] })));
      await auth.loadMe();
      expect(auth.role()).toBe('cliente');
    });

    it('sin sesión: rol null', async () => {
      const auth = setup();
      await auth.loadMe();
      clerk.user.set(null);
      expect(auth.role()).toBeNull();
      expect(auth.home()).toBe('/auth/sign-in');
    });
  });

  describe('perfil y DNI desde /me', () => {
    it('cliente completo: profileComplete y dni', async () => {
      const auth = setup();
      await auth.loadMe();
      expect(auth.profileComplete()).toBe(true);
      expect(auth.dni()).toBe('12345678');
    });

    it('cliente sin perfil: profileComplete false y dni null', async () => {
      const auth = setup(fakeUser(), () => of(me({ profile_complete: false, dni: null, name: null, profile: null })));
      await auth.loadMe();
      expect(auth.profileComplete()).toBe(false);
      expect(auth.dni()).toBeNull();
    });

    it('el DNI no se guarda ni se lee de Clerk', async () => {
      const user = fakeUser();
      const auth = setup(user, () => of(me({ dni: null, profile_complete: false })));
      await auth.loadMe();
      expect(auth.dni()).toBeNull();
      expect(user.updates).toEqual([]);
    });
  });

  describe('nombre para mostrar', () => {
    it('prefiere el del backend', async () => {
      const auth = setup(fakeUser({ name: 'Nombre Clerk' }), () => of(me({ name: 'Nombre Backend' })));
      await auth.loadMe();
      expect(auth.fullName()).toBe('Nombre Backend');
    });

    it('sin nombre en el backend usa el de Clerk', async () => {
      const auth = setup(fakeUser({ name: 'Nombre Clerk' }), () => of(me({ name: null })));
      await auth.loadMe();
      expect(auth.fullName()).toBe('Nombre Clerk');
    });

    it('sin ningún nombre usa el correo', async () => {
      const auth = setup(fakeUser({ name: null }), () => of(me({ name: null })));
      await auth.loadMe();
      expect(auth.fullName()).toBe('ana@correo.com');
    });
  });

  describe('loadMe', () => {
    it('cachea: una segunda llamada no consulta otra vez', async () => {
      const auth = setup();
      await auth.loadMe();
      await auth.loadMe();
      expect(getMe).toHaveBeenCalledTimes(1);
    });

    it('force vuelve a consultar', async () => {
      const auth = setup();
      await auth.loadMe();
      await auth.loadMe(true);
      expect(getMe).toHaveBeenCalledTimes(2);
    });

    it('llamadas simultáneas (varios guards) comparten una sola petición', async () => {
      const pending = new Subject<Me>();
      const auth = setup(fakeUser(), () => pending);
      const calls = Promise.all([auth.loadMe(), auth.loadMe(), auth.loadMe()]);
      pending.next(me());
      pending.complete();
      await calls;
      expect(getMe).toHaveBeenCalledTimes(1);
    });

    it('si cambia la cuenta, el perfil anterior se descarta', async () => {
      const auth = setup();
      await auth.loadMe();
      clerk.user.set(fakeUser({ email: 'otra@correo.com' }));
      expect(auth.me()).toBeNull();
      expect(auth.role()).toBeNull();
      await auth.loadMe();
      expect(getMe).toHaveBeenCalledTimes(2);
    });

    it('sin sesión rechaza', async () => {
      const auth = setup();
      clerk.user.set(null);
      await expect(auth.loadMe()).rejects.toThrow();
      expect(getMe).not.toHaveBeenCalled();
    });

    it.each([
      [401, 'unauthorized'],
      [403, 'forbidden'],
      [0, 'network'],
      [500, 'server'],
      [502, 'server'],
    ])('error %i -> meError "%s", propaga el error y no deja perfil', async (status, kind) => {
      const auth = setup(fakeUser(), () => throwError(() => new ApiError(status, 'X', 'fallo')));
      await expect(auth.loadMe()).rejects.toBeInstanceOf(ApiError);
      expect(auth.meError()).toBe(kind);
      expect(auth.me()).toBeNull();
    });

    it('un error que no es ApiError cuenta como fallo del servidor', async () => {
      const auth = setup(fakeUser(), () => throwError(() => new Error('raro')));
      await expect(auth.loadMe()).rejects.toThrow('raro');
      expect(auth.meError()).toBe('server');
    });

    it('un fallo no queda en caché: tras fallar se puede reintentar y limpia el error', async () => {
      let fail = true;
      const auth = setup(fakeUser(), () => (fail ? throwError(() => new ApiError(500, 'X', 'x')) : of(me())));
      await expect(auth.loadMe()).rejects.toBeDefined();
      fail = false;
      await auth.loadMe();
      expect(auth.meError()).toBeNull();
      expect(auth.role()).toBe('cliente');
      expect(getMe).toHaveBeenCalledTimes(2);
    });
  });

  describe('applyMe y markProfilePending', () => {
    it('applyMe guarda el perfil del backend (onboarding) sin nueva petición', () => {
      const auth = setup(fakeUser(), () => of(me({ profile_complete: false, dni: null })));
      auth.applyMe(me());
      expect(auth.profileComplete()).toBe(true);
      expect(auth.dni()).toBe('12345678');
      expect(getMe).not.toHaveBeenCalled();
    });

    it('markProfilePending deja el motivo "profile-pending"', () => {
      const auth = setup();
      auth.markProfilePending();
      expect(auth.meError()).toBe('profile-pending');
    });
  });

  describe('cierre de sesión', () => {
    it('signOut cierra Clerk, limpia el perfil y va al inicio de sesión', async () => {
      const auth = setup();
      const router = TestBed.inject(Router);
      const nav = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
      await auth.loadMe();
      await auth.signOut();
      expect(clerk.signOutCalls).toBe(1);
      expect(auth.me()).toBeNull();
      expect(nav).toHaveBeenCalledWith('/auth/sign-in');
    });

    it('expireSession cierra Clerk y limpia sin navegar', async () => {
      const auth = setup();
      const nav = vi.spyOn(TestBed.inject(Router), 'navigateByUrl');
      await auth.loadMe();
      await auth.expireSession();
      expect(clerk.signOutCalls).toBe(1);
      expect(auth.me()).toBeNull();
      expect(nav).not.toHaveBeenCalled();
    });
  });

  it('el correo sale de Clerk en minúsculas', () => {
    expect(setup(fakeUser({ email: 'Ana@Correo.COM' })).email()).toBe('ana@correo.com');
  });
});
