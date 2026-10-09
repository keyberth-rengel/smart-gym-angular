import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { FakeClerk, createFakeClerk, fakeUser, provideFakeClerk } from '../../testing/fake-clerk';
import { authTokenInterceptor } from './auth-token.interceptor';
import { environment } from '../../../environments/environment';
const API = environment.apiBase;

describe('authTokenInterceptor', () => {
  let clerk: FakeClerk;
  let http: HttpClient;
  let ctrl: HttpTestingController;

  function setup(signedIn: boolean) {
    clerk = createFakeClerk({ user: signedIn ? fakeUser() : null });
    TestBed.configureTestingModule({
      providers: [
        provideFakeClerk(clerk),
        provideHttpClient(withInterceptors([authTokenInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    http = TestBed.inject(HttpClient);
    ctrl = TestBed.inject(HttpTestingController);
  }

  afterEach(() => ctrl.verify());

  it('el header lleva exactamente el JWT de la sesión', async () => {
    setup(true);
    http.get(`${API}/health`).subscribe();
    await vi.waitFor(() => {
      const req = ctrl.match(`${API}/health`)[0];
      expect(req.request.headers.get('Authorization')).toBe('Bearer jwt-de-prueba');
    });
  });

  it('sin sesión no agrega nada ni pide token', () => {
    setup(false);
    http.get(`${API}/health`).subscribe();
    const req = ctrl.expectOne(`${API}/health`);
    expect(req.request.headers.has('Authorization')).toBe(false);
    expect(clerk.getTokenCalls).toBe(0);
  });

  it('una petición que no es del API no lleva el token', () => {
    setup(true);
    http.get('https://api.clerk.com/v1/client').subscribe();
    const req = ctrl.expectOne('https://api.clerk.com/v1/client');
    expect(req.request.headers.has('Authorization')).toBe(false);
    expect(clerk.getTokenCalls).toBe(0);
  });

  it('si Clerk no entrega token, la petición sale sin header', async () => {
    setup(true);
    clerk.token = null;
    http.get(`${API}/health`).subscribe();
    await vi.waitFor(() => {
      const req = ctrl.match(`${API}/health`)[0];
      expect(req).toBeDefined();
      expect(req.request.headers.has('Authorization')).toBe(false);
    });
  });
});
