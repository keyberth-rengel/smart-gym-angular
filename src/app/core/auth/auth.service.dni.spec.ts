import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { MeApi } from '../api/me.api';
import { FakeClerk, createFakeClerk, fakeUser, provideFakeClerk } from '../../testing/fake-clerk';
import { AuthService } from './auth.service';

describe('AuthService · DNI (interino hasta B2)', () => {
  let clerk: FakeClerk;

  function setup(user = fakeUser({ email: 'ana@correo.com' })) {
    clerk = createFakeClerk({ user });
    TestBed.configureTestingModule({
      providers: [provideRouter([]), provideFakeClerk(clerk), { provide: MeApi, useValue: {} }],
    });
    return TestBed.inject(AuthService);
  }

  it('sin DNI en Clerk es null', () => {
    expect(setup().dni()).toBeNull();
  });

  it('lee el DNI de unsafeMetadata', () => {
    expect(setup(fakeUser({ email: 'ana@correo.com', dni: '12345678' })).dni()).toBe('12345678');
  });

  it.each(['1234567', '123456789', 'abcdefgh', ''])('ignora un DNI inválido guardado ("%s")', (dni) => {
    expect(setup(fakeUser({ email: 'ana@correo.com', dni })).dni()).toBeNull();
  });

  it('un valor que no es texto se ignora', () => {
    const user = fakeUser({ email: 'ana@correo.com' });
    user.unsafeMetadata = { dni: 12345678 };
    expect(setup(user).dni()).toBeNull();
  });

  it('saveDni deja el DNI disponible al instante y lo guarda en Clerk conservando otra metadata', async () => {
    const user = fakeUser({ email: 'ana@correo.com' });
    user.unsafeMetadata = { tema: 'oscuro' };
    const auth = setup(user);
    await auth.saveDni(' 12345678 ');
    expect(auth.dni()).toBe('12345678');
    expect(user.updates).toEqual([{ unsafeMetadata: { tema: 'oscuro', dni: '12345678' } }]);
  });

  it('si Clerk falla, el DNI igual queda disponible en la sesión y el error se propaga', async () => {
    const user = fakeUser({ email: 'ana@correo.com' });
    user.update = async () => {
      throw new Error('clerk caído');
    };
    const auth = setup(user);
    await expect(auth.saveDni('12345678')).rejects.toThrow('clerk caído');
    expect(auth.dni()).toBe('12345678');
  });

  it('sin sesión saveDni no hace nada', async () => {
    const auth = setup();
    clerk.user.set(null);
    await auth.saveDni('12345678');
    expect(auth.dni()).toBeNull();
  });

  it('el DNI guardado en la sesión no se filtra a otra cuenta', async () => {
    const auth = setup();
    await auth.saveDni('12345678');
    clerk.user.set(fakeUser({ email: 'otra@correo.com' }));
    expect(auth.dni()).toBeNull();
  });

  it('al cerrar sesión se descarta', async () => {
    const auth = setup();
    vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    await auth.saveDni('12345678');
    await auth.signOut();
    expect(auth.dni()).toBeNull();
  });
});
