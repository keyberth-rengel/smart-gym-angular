import { HttpContext, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { SKIP_ERROR_TOAST, skipErrorToast } from '../http/error.interceptor';
import { ProgressApi } from './progress.api';
import { RoutinesApi } from './routines.api';
import { TrainersApi } from './trainers.api';
import { environment } from '../../../environments/environment';
const API = environment.apiBase;

const ok = (data: unknown) => ({ success: true, data, timestamp: 't', path: 'p' });

describe('APIs del entrenador', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  describe('TrainersApi', () => {
    it('customers: GET /trainers/{email}/customers con el correo codificado', () => {
      let result: unknown;
      TestBed.inject(TrainersApi)
        .customers('lucía+1@smartgym.pe')
        .subscribe((v) => (result = v));
      const req = http.expectOne(`${API}/trainers/luc%C3%ADa%2B1%40smartgym.pe/customers`);
      expect(req.request.method).toBe('GET');
      req.flush(ok([{ email: 'a@x.com', sessions: 2 }]));
      expect(result).toEqual([{ email: 'a@x.com', sessions: 2 }]);
    });

    it('bookings: un día, un rango, o nada (sin parámetros)', () => {
      const api = TestBed.inject(TrainersApi);

      api.bookings('t@x.com', { date: '2026-09-19' }).subscribe();
      let req = http.expectOne((r) => r.url === `${API}/trainers/t%40x.com/bookings`);
      expect(req.request.params.keys()).toEqual(['date']);
      expect(req.request.params.get('date')).toBe('2026-09-19');
      req.flush(ok([]));

      api.bookings('t@x.com', { from: '2026-09-14', to: '2026-09-20' }).subscribe();
      req = http.expectOne((r) => r.url === `${API}/trainers/t%40x.com/bookings`);
      expect(req.request.params.get('from')).toBe('2026-09-14');
      expect(req.request.params.get('to')).toBe('2026-09-20');
      expect(req.request.params.has('date')).toBe(false);
      req.flush(ok([]));

      api.bookings('t@x.com').subscribe();
      req = http.expectOne((r) => r.url === `${API}/trainers/t%40x.com/bookings`);
      expect(req.request.params.keys()).toEqual([]);
      req.flush(ok([]));
    });

    it('bookings ignora filtros vacíos', () => {
      TestBed.inject(TrainersApi).bookings('t@x.com', { from: '', to: '2026-09-20' }).subscribe();
      const req = http.expectOne((r) => r.url.endsWith('/bookings'));
      expect(req.request.params.keys()).toEqual(['to']);
      req.flush(ok([]));
    });

    it('propaga el contexto (SKIP_ERROR_TOAST)', () => {
      TestBed.inject(TrainersApi).customers('t@x.com', skipErrorToast()).subscribe();
      const req = http.expectOne(`${API}/trainers/t%40x.com/customers`);
      expect(req.request.context.get(SKIP_ERROR_TOAST)).toBe(true);
      req.flush(ok([]));
    });
  });

  describe('RoutinesApi', () => {
    it('assignByEmail envía solo customer_email (nunca dni)', () => {
      let result: unknown;
      TestBed.inject(RoutinesApi)
        .assignByEmail('ana@x.com')
        .subscribe((v) => (result = v));
      const req = http.expectOne(`${API}/routines/assign`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({ customer_email: 'ana@x.com' });
      req.flush(ok({ monday: 'Legs' }));
      expect(result).toEqual({ monday: 'Legs' });
    });

    it('historyByEmail: GET /routines/by-email/{email}/history', () => {
      TestBed.inject(RoutinesApi).historyByEmail('ana+1@x.com', skipErrorToast()).subscribe();
      const req = http.expectOne(`${API}/routines/by-email/ana%2B1%40x.com/history`);
      expect(req.request.method).toBe('GET');
      expect(req.request.context.get(SKIP_ERROR_TOAST)).toBe(true);
      req.flush(ok([]));
    });

    it('sin contexto, el toast automático sigue activo', () => {
      TestBed.inject(RoutinesApi).historyByEmail('ana@x.com').subscribe();
      const req = http.expectOne(`${API}/routines/by-email/ana%40x.com/history`);
      expect(req.request.context.get(SKIP_ERROR_TOAST)).toBe(false);
      req.flush(ok([]));
    });
  });

  describe('ProgressApi', () => {
    it('listByEmail: GET /progress/by-email/{email}', () => {
      let result: unknown;
      TestBed.inject(ProgressApi)
        .listByEmail('ana@x.com', new HttpContext().set(SKIP_ERROR_TOAST, true))
        .subscribe((v) => (result = v));
      const req = http.expectOne(`${API}/progress/by-email/ana%40x.com`);
      expect(req.request.method).toBe('GET');
      expect(req.request.context.get(SKIP_ERROR_TOAST)).toBe(true);
      req.flush(ok({ items: [], total: 0 }));
      expect(result).toEqual({ items: [], total: 0 });
    });
  });
});
