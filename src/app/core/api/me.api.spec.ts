import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, TestRequest, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { ToastService } from '../../shared/ui/toast/toast.service';
import { ApiError } from '../http/api-error';
import { errorInterceptor } from '../http/error.interceptor';
import { MeApi } from './me.api';

const ok = (data: unknown) => ({ success: true, data, message: 'ok', timestamp: 't', path: 'p' });
const fail = (code: string, message: string, details?: unknown) => ({
  success: false,
  message,
  error: { code, details },
  timestamp: 't',
  path: 'p',
});

const clienteMe = {
  role: 'cliente',
  email: 'ana@correo.com',
  name: 'Ana Pérez',
  dni: '12345678',
  profile_complete: true,
  profile: { email: 'ana@correo.com', name: 'Ana Pérez', age: 28 },
};

describe('MeApi', () => {
  let ctrl: HttpTestingController;
  let api: MeApi;
  let toast: ToastService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(withInterceptors([errorInterceptor])), provideHttpClientTesting()],
    });
    ctrl = TestBed.inject(HttpTestingController);
    api = TestBed.inject(MeApi);
    toast = TestBed.inject(ToastService);
  });

  afterEach(() => ctrl.verify());

  const flush = (req: TestRequest, body: string | object, status = 200) =>
    req.flush(body, { status, statusText: String(status) });

  describe('getMe', () => {
    it('GET /me y devuelve el perfil desenvuelto', async () => {
      const result = firstValueFrom(api.getMe());
      const req = ctrl.expectOne('/api/v1/me');
      expect(req.request.method).toBe('GET');
      flush(req, ok(clienteMe));
      expect(await result).toEqual(clienteMe);
    });

    it('cliente sin perfil: dni y profile nulos', async () => {
      const result = firstValueFrom(api.getMe());
      flush(ctrl.expectOne('/api/v1/me'), ok({ ...clienteMe, name: null, dni: null, profile_complete: false, profile: null }));
      expect(await result).toMatchObject({ dni: null, profile_complete: false, profile: null });
    });

    it.each([
      [401, 'UNAUTHORIZED', 'Unauthorized'],
      [403, 'FORBIDDEN', 'The token does not include the email; configure the session token in Clerk'],
      [500, 'INTERNAL_ERROR', 'Unexpected error'],
    ])('error %i: se propaga como ApiError y NO muestra toast', async (status, code, message) => {
      const result = firstValueFrom(api.getMe()).catch((e) => e);
      flush(ctrl.expectOne('/api/v1/me'), fail(code, message), status);
      const err = await result;
      expect(err).toBeInstanceOf(ApiError);
      expect((err as ApiError).status).toBe(status);
      expect(toast.toasts()).toEqual([]);
    });

    it('red caída: ApiError de red sin toast', async () => {
      const result = firstValueFrom(api.getMe()).catch((e) => e);
      ctrl.expectOne('/api/v1/me').error(new ProgressEvent('error'), { status: 0 });
      expect(((await result) as ApiError).isNetwork).toBe(true);
      expect(toast.toasts()).toEqual([]);
    });
  });

  describe('completeOnboarding', () => {
    const input = { name: 'Ana Pérez', age: 28, dni: '12345678' };

    it('POST /me/onboarding con nombre, edad y DNI (sin correo) y devuelve el perfil', async () => {
      const result = firstValueFrom(api.completeOnboarding(input));
      const req = ctrl.expectOne('/api/v1/me/onboarding');
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual(input);
      flush(req, ok(clienteMe), 201);
      expect(await result).toEqual(clienteMe);
    });

    it('idempotente (200) devuelve el mismo perfil', async () => {
      const result = firstValueFrom(api.completeOnboarding(input));
      flush(ctrl.expectOne('/api/v1/me/onboarding'), ok(clienteMe), 200);
      expect(await result).toEqual(clienteMe);
    });

    it.each([
      ['DNI already linked to another account', 'Este DNI ya está vinculado a otra cuenta.'],
      ['This account is already linked to a different DNI', 'Tu cuenta ya tiene otro DNI vinculado.'],
    ])('409 "%s": mensaje en español y sin toast automático', async (raw, expected) => {
      const result = firstValueFrom(api.completeOnboarding(input)).catch((e) => e);
      flush(ctrl.expectOne('/api/v1/me/onboarding'), fail('CONFLICT', raw), 409);
      const err = (await result) as ApiError;
      expect(err.status).toBe(409);
      expect(err.message).toBe(expected);
      expect(toast.toasts()).toEqual([]);
    });

    it('400 trae errores por campo', async () => {
      const result = firstValueFrom(api.completeOnboarding(input)).catch((e) => e);
      flush(
        ctrl.expectOne('/api/v1/me/onboarding'),
        fail('BAD_REQUEST', 'Validation failed', [{ field: 'dni', error: 'DNI must be 8 digits' }]),
        400,
      );
      const err = (await result) as ApiError;
      expect(err.status).toBe(400);
      expect(Object.keys(err.fieldErrors)).toEqual(['dni']);
      expect(toast.toasts()).toEqual([]);
    });

    it('403 de rol (entrenador/admin) llega como ApiError 403', async () => {
      const result = firstValueFrom(api.completeOnboarding(input)).catch((e) => e);
      flush(ctrl.expectOne('/api/v1/me/onboarding'), fail('FORBIDDEN', 'Access denied'), 403);
      expect(((await result) as ApiError).status).toBe(403);
    });
  });

  it('ya no depende de los endpoints interinos (/customers, /identity)', async () => {
    const result = firstValueFrom(api.getMe());
    flush(ctrl.expectOne('/api/v1/me'), ok(clienteMe));
    await result;
    ctrl.expectNone((r) => /\/customers|\/identity/.test(r.url));
  });
});
