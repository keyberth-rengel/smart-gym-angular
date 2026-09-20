import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { SKIP_ERROR_TOAST, skipErrorToast } from '../http/error.interceptor';
import { CustomersApi } from './customers.api';
import { HealthApi } from './health.api';
import { TrainersApi } from './trainers.api';

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
      const req = http.expectOne('/api/v1/customers');
      expect(req.request.method).toBe('GET');
      req.flush(ok([{ email: 'a@x.com', name: 'Ana', age: 20 }]));
      expect(result).toEqual([{ email: 'a@x.com', name: 'Ana', age: 20 }]);
    });

    it('create sin dni: el cuerpo no lleva la clave dni', () => {
      TestBed.inject(CustomersApi)
        .create({ email: 'a@x.com', name: 'Ana', age: 20 })
        .subscribe();
      const req = http.expectOne('/api/v1/customers');
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({ email: 'a@x.com', name: 'Ana', age: 20 });
      expect('dni' in req.request.body).toBe(false);
      req.flush(ok({ email: 'a@x.com', name: 'Ana', age: 20 }));
    });

    it('create con dni: lo envía y propaga el contexto', () => {
      TestBed.inject(CustomersApi)
        .create({ email: 'a@x.com', name: 'Ana', age: 20, dni: '12345678' }, skipErrorToast())
        .subscribe();
      const req = http.expectOne('/api/v1/customers');
      expect(req.request.body.dni).toBe('12345678');
      expect(req.request.context.get(SKIP_ERROR_TOAST)).toBe(true);
      req.flush(ok({}));
    });
  });

  describe('TrainersApi', () => {
    it('create devuelve el entrenador con el resultado de la invitación', () => {
      let result: unknown;
      TestBed.inject(TrainersApi)
        .create({ email: 't@x.com', name: 'Luis', age: 30, specialty: 'Funcional', dni: '87654321' })
        .subscribe((v) => (result = v));
      const req = http.expectOne('/api/v1/trainers');
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
      const req = http.expectOne('/api/v1/trainers/luc%C3%ADa%2B1%40smartgym.pe/invite');
      expect(req.request.method).toBe('POST');
      expect(req.request.context.get(SKIP_ERROR_TOAST)).toBe(true);
      req.flush(ok({ status: 'INVITED', message: 'ok' }));
      expect(result).toEqual({ status: 'INVITED', message: 'ok' });
    });
  });

  describe('HealthApi', () => {
    it('check propaga el contexto para no mostrar toast', () => {
      TestBed.inject(HealthApi).check(skipErrorToast()).subscribe();
      const req = http.expectOne('/api/v1/health');
      expect(req.request.context.get(SKIP_ERROR_TOAST)).toBe(true);
      req.flush(ok({ status: 'UP', uptimeSeconds: 1, startedAt: 't' }));
    });
  });
});
