import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { SKIP_ERROR_TOAST, skipErrorToast } from '../http/error.interceptor';
import { AttendanceApi } from './attendance.api';
import { BookingsApi } from './bookings.api';
import { CustomersApi } from './customers.api';
import { HealthApi } from './health.api';
import { IdentityApi } from './identity.api';
import { RoutinesApi } from './routines.api';
import { TrainersApi } from './trainers.api';
import { environment } from '../../../environments/environment';
const API = environment.apiBase;

const ok = (data: unknown) => ({ success: true, data, timestamp: 't', path: 'p' });

describe('APIs del admin', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  describe('CustomersApi', () => {
    it('list: GET /customers y devuelve el arreglo', () => {
      let result: unknown;
      TestBed.inject(CustomersApi)
        .list()
        .subscribe((v) => (result = v));
      const req = http.expectOne(`${API}/customers`);
      expect(req.request.method).toBe('GET');
      req.flush(ok([{ email: 'a@x.com', name: 'Ana', age: 20 }]));
      expect(result).toEqual([{ email: 'a@x.com', name: 'Ana', age: 20 }]);
    });

    it('create sin dni: el cuerpo no lleva la clave dni', () => {
      TestBed.inject(CustomersApi).create({ email: 'a@x.com', name: 'Ana', age: 20 }).subscribe();
      const req = http.expectOne(`${API}/customers`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({ email: 'a@x.com', name: 'Ana', age: 20 });
      expect('dni' in req.request.body).toBe(false);
      req.flush(ok({ email: 'a@x.com', name: 'Ana', age: 20 }));
    });

    it('create con dni: lo envía y propaga el contexto', () => {
      TestBed.inject(CustomersApi)
        .create({ email: 'a@x.com', name: 'Ana', age: 20, dni: '12345678' }, skipErrorToast())
        .subscribe();
      const req = http.expectOne(`${API}/customers`);
      expect(req.request.body.dni).toBe('12345678');
      expect(req.request.context.get(SKIP_ERROR_TOAST)).toBe(true);
      req.flush(ok({}));
    });
  });

  describe('TrainersApi', () => {
    it('create devuelve el entrenador con el resultado de la invitación', () => {
      let result: unknown;
      TestBed.inject(TrainersApi)
        .create({
          email: 't@x.com',
          name: 'Luis',
          age: 30,
          specialty: 'Funcional',
          dni: '87654321',
        })
        .subscribe((v) => (result = v));
      const req = http.expectOne(`${API}/trainers`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({
        email: 't@x.com',
        name: 'Luis',
        age: 30,
        specialty: 'Funcional',
        dni: '87654321',
      });
      req.flush(
        ok({
          email: 't@x.com',
          name: 'Luis',
          age: 30,
          specialty: 'Funcional',
          dni: '87654321',
          invitation: { status: 'SKIPPED', message: 'clerk_not_configured' },
        }),
      );
      expect((result as { invitation: { status: string } }).invitation.status).toBe('SKIPPED');
    });

    it('invite: POST /trainers/{email}/invite con el correo codificado', () => {
      let result: unknown;
      TestBed.inject(TrainersApi)
        .invite('lucía+1@smartgym.pe', skipErrorToast())
        .subscribe((v) => (result = v));
      const req = http.expectOne(`${API}/trainers/luc%C3%ADa%2B1%40smartgym.pe/invite`);
      expect(req.request.method).toBe('POST');
      expect(req.request.context.get(SKIP_ERROR_TOAST)).toBe(true);
      req.flush(ok({ status: 'INVITED', message: 'ok' }));
      expect(result).toEqual({ status: 'INVITED', message: 'ok' });
    });
  });

  describe('HealthApi', () => {
    it('check propaga el contexto para no mostrar toast', () => {
      TestBed.inject(HealthApi).check(skipErrorToast()).subscribe();
      const req = http.expectOne(`${API}/health`);
      expect(req.request.context.get(SKIP_ERROR_TOAST)).toBe(true);
      req.flush(ok({ status: 'UP', uptimeSeconds: 1, startedAt: 't' }));
    });
  });
  describe('BookingsApi (admin)', () => {
    it('list: GET /bookings, desenvuelve y propaga el contexto', () => {
      let result: unknown;
      TestBed.inject(BookingsApi)
        .list(skipErrorToast())
        .subscribe((v) => (result = v));
      const req = http.expectOne(`${API}/bookings`);
      expect(req.request.method).toBe('GET');
      expect(req.request.context.get(SKIP_ERROR_TOAST)).toBe(true);
      req.flush(
        ok([
          {
            id: 14,
            customer_email: 'a@x.com',
            trainer_email: 't@x.com',
            date: '2026-09-19',
            time: '16:30',
            note: null,
          },
        ]),
      );
      expect(result).toEqual([
        {
          id: 14,
          customer_email: 'a@x.com',
          trainer_email: 't@x.com',
          date: '2026-09-19',
          time: '16:30',
          note: null,
        },
      ]);
    });

    it('cancel: DELETE /bookings/{id} tolera el 204 sin cuerpo', () => {
      let done = false;
      TestBed.inject(BookingsApi)
        .cancel(14)
        .subscribe({ complete: () => (done = true) });
      const req = http.expectOne(`${API}/bookings/14`);
      expect(req.request.method).toBe('DELETE');
      req.flush(null, { status: 204, statusText: 'No Content' });
      expect(done).toBe(true);
    });

    it('cancel: un 404 llega como error HTTP al llamador', () => {
      let status = 0;
      TestBed.inject(BookingsApi)
        .cancel(99)
        .subscribe({ error: (e) => (status = e.status) });
      http
        .expectOne(`${API}/bookings/99`)
        .flush({ success: false }, { status: 404, statusText: 'Not Found' });
      expect(status).toBe(404);
    });
  });

  describe('RoutinesApi e IdentityApi (admin por DNI)', () => {
    it('assign: POST /routines/assign con { dni } y contexto opcional', () => {
      let plan: unknown;
      TestBed.inject(RoutinesApi)
        .assign('74582136', skipErrorToast())
        .subscribe((v) => (plan = v));
      const req = http.expectOne(`${API}/routines/assign`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({ dni: '74582136' });
      expect(req.request.context.get(SKIP_ERROR_TOAST)).toBe(true);
      req.flush(ok({ monday: 'Legs' }));
      expect(plan).toEqual({ monday: 'Legs' });
    });

    it('history: GET /routines/history/{dni} con el DNI codificado', () => {
      TestBed.inject(RoutinesApi).history('7458 2136', skipErrorToast()).subscribe();
      const req = http.expectOne(`${API}/routines/history/7458%202136`);
      expect(req.request.method).toBe('GET');
      expect(req.request.context.get(SKIP_ERROR_TOAST)).toBe(true);
      req.flush(ok([]));
    });

    it('resolve: GET /identity/{dni}', () => {
      let id: unknown;
      TestBed.inject(IdentityApi)
        .resolve('74582136', skipErrorToast())
        .subscribe((v) => (id = v));
      const req = http.expectOne(`${API}/identity/74582136`);
      expect(req.request.context.get(SKIP_ERROR_TOAST)).toBe(true);
      req.flush(ok({ dni: '74582136', email: 'a@x.com' }));
      expect(id).toEqual({ dni: '74582136', email: 'a@x.com' });
    });
  });

  describe('AttendanceApi (admin por DNI)', () => {
    it('access: POST /access con { dni } y devuelve el texto de bienvenida', () => {
      let msg: unknown;
      TestBed.inject(AttendanceApi)
        .access('74582136')
        .subscribe((v) => (msg = v));
      const req = http.expectOne(`${API}/access`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({ dni: '74582136' });
      expect(req.request.context.get(SKIP_ERROR_TOAST)).toBe(false);
      req.flush(ok('Welcome Ana! Access recorded for a@x.com.'));
      expect(msg).toBe('Welcome Ana! Access recorded for a@x.com.');
    });

    it('list: GET /attendance/{dni} y propaga el contexto', () => {
      TestBed.inject(AttendanceApi).list('74582136', skipErrorToast()).subscribe();
      const req = http.expectOne(`${API}/attendance/74582136`);
      expect(req.request.context.get(SKIP_ERROR_TOAST)).toBe(true);
      req.flush(ok([]));
    });
  });

  describe('TrainersApi.list', () => {
    it('propaga el contexto (las cargas de apoyo no muestran toast)', () => {
      TestBed.inject(TrainersApi).list(skipErrorToast()).subscribe();
      const req = http.expectOne(`${API}/trainers`);
      expect(req.request.context.get(SKIP_ERROR_TOAST)).toBe(true);
      req.flush(ok([]));
    });
  });
});
