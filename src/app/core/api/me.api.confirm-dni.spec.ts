import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { createFakeClerk, fakeUser, provideFakeClerk } from '../../testing/fake-clerk';
import { ApiError } from '../http/api-error';
import { errorInterceptor } from '../http/error.interceptor';
import { MeApi } from './me.api';

const ok = (data: unknown) => ({ success: true, data, message: 'ok', timestamp: 't', path: 'p' });

describe('MeApi.confirmDni', () => {
  let ctrl: HttpTestingController;
  let api: MeApi;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideFakeClerk(createFakeClerk({ user: fakeUser({ email: 'ana@correo.com' }) })),
        provideHttpClient(withInterceptors([errorInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    ctrl = TestBed.inject(HttpTestingController);
    api = TestBed.inject(MeApi);
  });
  afterEach(() => ctrl.verify());

  it('acepta un DNI vinculado al mismo correo (sin distinguir mayúsculas)', async () => {
    const p = firstValueFrom(api.confirmDni(' 12345678 ', 'ana@correo.com'));
    ctrl.expectOne('/api/v1/identity/12345678').flush(ok({ dni: '12345678', email: 'ANA@correo.com' }));
    await expect(p).resolves.toBeUndefined();
  });

  it('un DNI vinculado a otro correo se rechaza con error en el campo', async () => {
    const p = firstValueFrom(api.confirmDni('12345678', 'ana@correo.com'));
    ctrl.expectOne('/api/v1/identity/12345678').flush(ok({ dni: '12345678', email: 'otra@correo.com' }));
    const err = (await p.catch((e) => e)) as ApiError;
    expect(err).toBeInstanceOf(ApiError);
    expect(err.fieldErrors['dni']).toBe('Este DNI ya está vinculado a otra cuenta.');
  });

  it('un DNI inexistente (404) se rechaza con error en el campo', async () => {
    const p = firstValueFrom(api.confirmDni('12345678', 'ana@correo.com'));
    ctrl.expectOne('/api/v1/identity/12345678').flush({ success: false, message: 'DNI not linked', error: { code: 'NOT_FOUND' } }, { status: 404, statusText: 'Not Found' });
    const err = (await p.catch((e) => e)) as ApiError;
    expect(err.fieldErrors['dni']).toBe('Este DNI no está vinculado a ninguna cuenta de SmartGym.');
  });

  it('un error del servidor se propaga tal cual', async () => {
    const p = firstValueFrom(api.confirmDni('12345678', 'ana@correo.com'));
    ctrl.expectOne('/api/v1/identity/12345678').flush('', { status: 500, statusText: 'Server Error' });
    const err = (await p.catch((e) => e)) as ApiError;
    expect(err.isServer).toBe(true);
  });
});
