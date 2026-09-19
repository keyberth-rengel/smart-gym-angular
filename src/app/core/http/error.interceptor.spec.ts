import { HttpClient, HttpContext, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ToastService } from '../../shared/ui/toast/toast.service';
import { ApiError } from './api-error';
import { SKIP_ERROR_TOAST, errorInterceptor } from './error.interceptor';

describe('errorInterceptor', () => {
  let http: HttpClient;
  let ctrl: HttpTestingController;
  let toast: ToastService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([errorInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    http = TestBed.inject(HttpClient);
    ctrl = TestBed.inject(HttpTestingController);
    toast = TestBed.inject(ToastService);
  });

  afterEach(() => ctrl.verify());

  function fail(
    status: number,
    body: unknown,
    options: { url?: string; context?: HttpContext } = {},
  ): { error: ApiError | unknown } {
    const out: { error: ApiError | unknown } = { error: null };
    http.get(options.url ?? '/api/v1/x', { context: options.context }).subscribe({
      error: (e) => (out.error = e),
    });
    ctrl
      .expectOne(options.url ?? '/api/v1/x')
      .flush(body as string | object, { status, statusText: 'err' });
    return out;
  }

  const envelope = (message: string, code: string, details?: unknown) => ({
    success: false,
    message,
    error: { code, details },
    timestamp: 't',
    path: 'p',
  });

  it('400 con details: fieldErrors traducidos y sin toast', () => {
    const { error } = fail(
      400,
      envelope('Validation failed', 'BAD_REQUEST', [
        { field: 'email', error: 'must be a well-formed email address' },
        { field: 'name', error: 'must not be blank' },
        { field: 'age', error: 'must be greater than or equal to 0' },
      ]),
    );
    const e = error as ApiError;
    expect(e).toBeInstanceOf(ApiError);
    expect(e.status).toBe(400);
    expect(e.code).toBe('BAD_REQUEST');
    expect(e.fieldErrors).toEqual({
      email: 'Ingresa un correo válido.',
      name: 'Este campo es obligatorio.',
      age: 'Debe ser mayor o igual a 0.',
    });
    expect(toast.toasts()).toHaveLength(0);
  });

  it('404 no muestra toast', () => {
    const { error } = fail(404, envelope('DNI not linked', 'NOT_FOUND'));
    const e = error as ApiError;
    expect(e.status).toBe(404);
    expect(e.isNotFound).toBe(true);
    expect(e.message).toBe('Este DNI no está vinculado a ninguna cuenta de SmartGym.');
    expect(toast.toasts()).toHaveLength(0);
  });

  it('409 muestra toast de error con el mensaje en español', () => {
    fail(409, envelope('Trainer already has a booking at 2026-09-19 23:59.', 'CONFLICT'));
    const [t] = toast.toasts();
    expect(t.kind).toBe('error');
    expect(t.message).toBe('Ese horario ya está ocupado para este entrenador. Elige otra hora.');
  });

  it('422 muestra toast de advertencia', () => {
    fail(422, envelope('Bookings in the past are not allowed.', 'UNPROCESSABLE_ENTITY'));
    const [t] = toast.toasts();
    expect(t.kind).toBe('warning');
    expect(t.message).toBe('No se pueden crear reservas en horas que ya pasaron.');
  });

  it('422 de "no encontrado" se trata como 404: sin toast', () => {
    const { error } = fail(422, envelope('Customer not found: a@x.com', 'UNPROCESSABLE_ENTITY'));
    expect((error as ApiError).isNotFound).toBe(true);
    expect(toast.toasts()).toHaveLength(0);
  });

  it('500 con cuerpo vacío (proxy con backend caído) muestra servicio no disponible', () => {
    const { error } = fail(500, '');
    const e = error as ApiError;
    expect(e.isServer).toBe(true);
    const [t] = toast.toasts();
    expect(t.kind).toBe('error');
    expect(t.message).toBe('El servicio no está disponible. Inténtalo de nuevo en unos minutos.');
  });

  it('500 del backend con envoltorio también muestra servicio no disponible', () => {
    fail(500, envelope('Unexpected error', 'INTERNAL_ERROR'));
    expect(toast.toasts()[0].message).toContain('El servicio no está disponible');
  });

  it('status 0 (red caída) muestra servicio no disponible', () => {
    const out: { error: unknown } = { error: null };
    http.get('/api/v1/x').subscribe({ error: (e) => (out.error = e) });
    ctrl.expectOne('/api/v1/x').error(new ProgressEvent('error'));
    const e = out.error as ApiError;
    expect(e.isNetwork).toBe(true);
    expect(e.code).toBe('NETWORK_ERROR');
    expect(toast.toasts()[0].message).toContain('El servicio no está disponible');
  });

  it('401 y 403 muestran falta de permisos', () => {
    fail(401, envelope('Unauthorized', 'UNAUTHORIZED'));
    fail(403, envelope('Forbidden', 'FORBIDDEN'));
    expect(toast.toasts().map((t) => t.message)).toEqual([
      'No tienes permisos para esta acción.',
      'No tienes permisos para esta acción.',
    ]);
  });

  it('SKIP_ERROR_TOAST silencia el toast pero conserva el ApiError', () => {
    const context = new HttpContext().set(SKIP_ERROR_TOAST, true);
    const { error } = fail(409, envelope('Customer already exists: a@x.com', 'CONFLICT'), {
      context,
    });
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).message).toBe('Ya existe un cliente con ese correo.');
    expect(toast.toasts()).toHaveLength(0);
  });

  it('ignora peticiones que no son del API', () => {
    const { error } = fail(500, 'x', { url: 'https://otro.dominio/recurso' });
    expect(error).not.toBeInstanceOf(ApiError);
    expect(toast.toasts()).toHaveLength(0);
  });
});
