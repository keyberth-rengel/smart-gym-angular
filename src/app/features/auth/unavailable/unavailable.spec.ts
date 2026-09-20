import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { MeApi } from '../../../core/api/me.api';
import { AuthService, MeErrorKind } from '../../../core/auth/auth.service';
import { ApiError } from '../../../core/http/api-error';
import { Me } from '../../../core/models';
import { createFakeClerk, fakeUser, provideFakeClerk } from '../../../testing/fake-clerk';
import { Unavailable } from './unavailable';

const me: Me = {
  role: 'cliente',
  email: 'ana@correo.com',
  name: 'Ana',
  dni: '12345678',
  profile_complete: true,
  profile: null,
};

describe('Unavailable', () => {
  let fixture: ComponentFixture<Unavailable>;
  let auth: AuthService;
  let router: Router;
  let getMe: ReturnType<typeof vi.fn>;

  function setup(
    kind: MeErrorKind | null,
    result: () => ReturnType<MeApi['getMe']> = () => of(me),
  ) {
    getMe = vi.fn(result);
    TestBed.configureTestingModule({
      imports: [Unavailable],
      providers: [
        provideRouter([]),
        provideFakeClerk(createFakeClerk({ user: fakeUser() })),
        { provide: MeApi, useValue: { getMe } },
      ],
    });
    auth = TestBed.inject(AuthService);
    auth.meError.set(kind);
    router = TestBed.inject(Router);
    vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
    fixture = TestBed.createComponent(Unavailable);
    fixture.detectChanges();
  }

  const text = (id: string) =>
    (fixture.nativeElement as HTMLElement)
      .querySelector(`[data-testid=${id}]`)!
      .textContent!.trim();

  it.each([
    ['network', 'Sin conexión con el servicio', 'El servidor de SmartGym no está respondiendo'],
    ['server', 'Sin conexión con el servicio', 'El servidor de SmartGym no está respondiendo'],
    ['forbidden', 'Sesión incompleta', 'no incluye el correo'],
    ['unauthorized', 'Sesión vencida', 'ya no es válida'],
    ['profile-pending', 'Registro pendiente', 'administrador debe completar tu registro'],
    ['clerk', 'Sin conexión con el servicio', 'No se pudo cargar el servicio de acceso'],
  ] as const)('motivo %s: badge "%s" y texto explicativo', (kind, badge, snippet) => {
    setup(kind);
    expect(text('un-badge')).toBe(badge);
    expect(text('un-text')).toContain(snippet);
  });

  it('con el motivo clerk no ofrece "Salir" (no hay sesión que cerrar) y sí "Reintentar"', () => {
    setup('clerk');
    const html = fixture.nativeElement as HTMLElement;
    expect(html.querySelector('[data-testid=retry]')).not.toBeNull();
    expect(html.textContent).not.toContain('Salir');
  });

  it('con otros motivos sí ofrece "Salir"', () => {
    setup('server');
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Salir');
  });

  it('sin motivo conocido (recarga directa) usa el mensaje de conexión', () => {
    setup(null);
    expect(text('un-badge')).toBe('Sin conexión con el servicio');
  });

  it('Reintentar vuelve a pedir /me (forzado) y navega a "/"', async () => {
    setup('server');
    (fixture.nativeElement.querySelector('[data-testid=retry]') as HTMLButtonElement).click();
    await vi.waitFor(() => expect(router.navigateByUrl).toHaveBeenCalledWith('/'));
    expect(getMe).toHaveBeenCalledTimes(1);
    expect(auth.role()).toBe('cliente');
  });

  it('si el reintento sigue fallando actualiza el motivo y navega igualmente', async () => {
    setup('server', () => throwError(() => new ApiError(403, 'FORBIDDEN', 'x')));
    (fixture.nativeElement.querySelector('[data-testid=retry]') as HTMLButtonElement).click();
    await vi.waitFor(() => expect(router.navigateByUrl).toHaveBeenCalledWith('/'));
    expect(auth.meError()).toBe('forbidden');
    fixture.detectChanges();
    expect(text('un-badge')).toBe('Sesión incompleta');
  });

  it('el botón queda deshabilitado mientras reintenta', async () => {
    setup('network');
    const btn = fixture.nativeElement.querySelector('[data-testid=retry]') as HTMLButtonElement;
    btn.click();
    fixture.detectChanges();
    expect(btn.disabled).toBe(true);
    await vi.waitFor(() => expect(router.navigateByUrl).toHaveBeenCalled());
  });
});
