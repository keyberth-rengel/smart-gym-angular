import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ApiClient } from './api-client';

describe('ApiClient', () => {
  let api: ApiClient;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    api = TestBed.inject(ApiClient);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('antepone apiBase y devuelve data desenvuelto', () => {
    let result: unknown;
    api.get<{ name: string }>('/customers/a@x.com').subscribe((v) => (result = v));

    const req = http.expectOne('/api/v1/customers/a@x.com');
    expect(req.request.method).toBe('GET');
    req.flush({ success: true, data: { name: 'Ana' }, timestamp: 't', path: '/p' });

    expect(result).toEqual({ name: 'Ana' });
  });

  it('acepta rutas sin barra inicial', () => {
    api.get('health').subscribe();
    http.expectOne('/api/v1/health').flush({ success: true, data: {}, timestamp: 't', path: 'p' });
  });

  it('envía query params', () => {
    api.get('/x', { params: { date: '2026-09-19' } }).subscribe();
    const req = http.expectOne((r) => r.url === '/api/v1/x');
    expect(req.request.params.get('date')).toBe('2026-09-19');
    req.flush({ success: true, data: [], timestamp: 't', path: 'p' });
  });

  it('post envía el cuerpo y desenvuelve data', () => {
    let result: unknown;
    api.post<number>('/bookings', { time: '16:30' }).subscribe((v) => (result = v));
    const req = http.expectOne('/api/v1/bookings');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ time: '16:30' });
    req.flush({ success: true, data: 7, timestamp: 't', path: 'p' });
    expect(result).toBe(7);
  });

  it('delete tolera respuesta 204 sin cuerpo', () => {
    let done = false;
    let value: unknown = 'sin-valor';
    api.delete('/bookings/1').subscribe({
      next: (v) => (value = v),
      complete: () => (done = true),
    });
    const req = http.expectOne('/api/v1/bookings/1');
    expect(req.request.method).toBe('DELETE');
    req.flush(null, { status: 204, statusText: 'No Content' });
    expect(done).toBe(true);
    expect(value).toBeUndefined();
  });
});
