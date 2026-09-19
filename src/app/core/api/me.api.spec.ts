import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, TestRequest, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { FakeClerk, createFakeClerk, fakeUser, provideFakeClerk } from '../../testing/fake-clerk';
import { ApiError } from '../http/api-error';
import { errorInterceptor } from '../http/error.interceptor';
import { MeApi } from './me.api';

const ok = (data: unknown) => ({ success: true, data, message: 'ok', timestamp: 't', path: 'p' });
const fail = (code: string, message: string) => ({
  success: false,
  message,
  error: { code },
  timestamp: 't',
  path: 'p',
});

describe('MeApi (interino)', () => {
  let ctrl: HttpTestingController;
  let clerk: FakeClerk;
  let api: MeApi;

  function setup(role?: unknown) {
    clerk = createFakeClerk({ user: fakeUser({ role, email: 'ana@correo.com' }) });
    TestBed.configureTestingModule({
      providers: [
        provideFakeClerk(clerk),
        provideHttpClient(withInterceptors([errorInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    ctrl = TestBed.inject(HttpTestingController);
    api = TestBed.inject(MeApi);
  }

  afterEach(() => ctrl.verify());

  const flush = (req: TestRequest, body: string | object, status = 200) =>
    req.flush(body, { status, statusText: String(status) });

  // Deja que cada paso encadenado emita su petición antes de responder.
  const next = async (url: string, method: string): Promise<TestRequest> => {
    let found: TestRequest | undefined;
    await vi.waitFor(() => {
      const matches = ctrl.match((r) => r.url === url && r.method === method);
      expect(matches.length).toBe(1);
      found = matches[0];
    });
    return found!;
  };

  const customer = { email: 'ana@correo.com', name: 'Ana Pérez', age: 28 };
  const input = { name: ' Ana Pérez ', email: ' Ana@Correo.com ', age: 28, dni: ' 12345678 ' };

  describe('getMe', () => {
    it('cliente con registro: perfil completo', async () => {
      setup();
      const promise = firstValueFrom(api.getMe());
      flush(ctrl.expectOne('/api/v1/customers/ana%40correo.com'), ok(customer));
      expect(await promise).toEqual({ email: 'ana@correo.com', role: 'cliente', profile_complete: true });
    });

    it('cliente sin registro (404): perfil incompleto', async () => {
      setup();
      const promise = firstValueFrom(api.getMe());
      flush(ctrl.expectOne('/api/v1/customers/ana%40correo.com'), fail('NOT_FOUND', 'Customer not found'), 404);
      expect((await promise).profile_complete).toBe(false);
    });

    it('cliente sin registro (422 "not found"): perfil incompleto', async () => {
      setup();
      const promise = firstValueFrom(api.getMe());
      flush(ctrl.expectOne('/api/v1/customers/ana%40correo.com'), fail('UNPROCESSABLE_ENTITY', 'Customer not found: ana'), 422);
      expect((await promise).profile_complete).toBe(false);
    });

    it('error del backend (500): se propaga, no se asume incompleto', async () => {
      setup();
      const promise = firstValueFrom(api.getMe());
      flush(ctrl.expectOne('/api/v1/customers/ana%40correo.com'), '', 500);
      await expect(promise).rejects.toMatchObject({ status: 500 });
    });

    it.each(['entrenador', 'admin'])('%s: completo sin llamar al backend', async (role) => {
      setup(role);
      const me = await firstValueFrom(api.getMe());
      expect(me).toEqual({ email: 'ana@correo.com', role, profile_complete: true });
      ctrl.expectNone(() => true);
    });
  });

  describe('completeOnboarding', () => {
    it('DNI libre y cliente nuevo: vincula y luego crea (en ese orden)', async () => {
      setup();
      const done = firstValueFrom(api.completeOnboarding(input));

      flush(await next('/api/v1/identity/12345678', 'GET'), fail('NOT_FOUND', 'DNI not linked'), 404);

      const link = await next('/api/v1/identity/customer', 'POST');
      expect(link.request.body).toEqual({ dni: '12345678', email: 'ana@correo.com' });
      flush(link, ok({ dni: '12345678', email: 'ana@correo.com' }), 201);

      flush(await next('/api/v1/customers/ana%40correo.com', 'GET'), fail('NOT_FOUND', 'Customer not found'), 404);

      const create = await next('/api/v1/customers', 'POST');
      expect(create.request.body).toEqual({ email: 'ana@correo.com', name: 'Ana Pérez', age: 28 });
      flush(create, ok(customer), 201);

      await expect(done).resolves.toBeUndefined();
    });

    it('reintento: DNI ya vinculado a esta cuenta no se vuelve a vincular', async () => {
      setup();
      const done = firstValueFrom(api.completeOnboarding(input));

      flush(await next('/api/v1/identity/12345678', 'GET'), ok({ dni: '12345678', email: 'ANA@correo.com' }));
      flush(await next('/api/v1/customers/ana%40correo.com', 'GET'), fail('NOT_FOUND', 'Customer not found'), 404);
      flush(await next('/api/v1/customers', 'POST'), ok(customer), 201);

      await expect(done).resolves.toBeUndefined();
      ctrl.expectNone('/api/v1/identity/customer');
    });

    it('si el cliente ya existe no lo crea otra vez', async () => {
      setup();
      const done = firstValueFrom(api.completeOnboarding(input));

      flush(await next('/api/v1/identity/12345678', 'GET'), fail('NOT_FOUND', 'DNI not linked'), 404);
      flush(await next('/api/v1/identity/customer', 'POST'), ok({}), 201);
      flush(await next('/api/v1/customers/ana%40correo.com', 'GET'), ok(customer));

      await expect(done).resolves.toBeUndefined();
      ctrl.expectNone('/api/v1/customers');
    });

    it('DNI vinculado a OTRA cuenta: error de campo y no toca nada más', async () => {
      setup();
      const done = firstValueFrom(api.completeOnboarding(input));
      flush(await next('/api/v1/identity/12345678', 'GET'), ok({ dni: '12345678', email: 'otra@correo.com' }));

      const err = (await done.catch((e) => e)) as ApiError;
      expect(err).toBeInstanceOf(ApiError);
      expect(err.status).toBe(409);
      expect(err.fieldErrors['dni']).toBe('Este DNI ya está vinculado a otra cuenta.');
      ctrl.expectNone('/api/v1/identity/customer');
      ctrl.expectNone('/api/v1/customers');
    });

    it('DNI no vinculado (422 "not linked") se trata como libre', async () => {
      setup();
      const done = firstValueFrom(api.completeOnboarding(input));
      flush(await next('/api/v1/identity/12345678', 'GET'), fail('UNPROCESSABLE_ENTITY', 'DNI not linked'), 422);
      flush(await next('/api/v1/identity/customer', 'POST'), ok({}), 201);
      flush(await next('/api/v1/customers/ana%40correo.com', 'GET'), ok(customer));
      await expect(done).resolves.toBeUndefined();
    });

    it('backend caído al consultar el DNI: error de red, sin crear nada', async () => {
      setup();
      const done = firstValueFrom(api.completeOnboarding(input));
      (await next('/api/v1/identity/12345678', 'GET')).error(new ProgressEvent('error'), { status: 0 });
      await expect(done).rejects.toMatchObject({ status: 0 });
      ctrl.expectNone('/api/v1/identity/customer');
    });

    it('error 400 al crear el cliente conserva los errores de campo', async () => {
      setup();
      const done = firstValueFrom(api.completeOnboarding(input));
      flush(await next('/api/v1/identity/12345678', 'GET'), fail('NOT_FOUND', 'DNI not linked'), 404);
      flush(await next('/api/v1/identity/customer', 'POST'), ok({}), 201);
      flush(await next('/api/v1/customers/ana%40correo.com', 'GET'), fail('NOT_FOUND', 'Customer not found'), 404);
      flush(
        await next('/api/v1/customers', 'POST'),
        { ...fail('BAD_REQUEST', 'Validation failed'), error: { code: 'BAD_REQUEST', details: [{ field: 'age', error: 'must be greater than or equal to 0' }] } },
        400,
      );
      const err = (await done.catch((e) => e)) as ApiError;
      expect(err.status).toBe(400);
      expect(err.fieldErrors['age']).toBe('Debe ser mayor o igual a 0.');
    });
  });
});
