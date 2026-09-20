import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { Observable, Subject, of, throwError } from 'rxjs';
import { MeApi } from '../../../core/api/me.api';
import { AuthService } from '../../../core/auth/auth.service';
import { ApiError } from '../../../core/http/api-error';
import { ToastService } from '../../../shared/ui/toast/toast.service';
import { FakeUser, createFakeClerk, fakeUser, provideFakeClerk } from '../../../testing/fake-clerk';
import { ConfirmDni } from './confirm-dni';

describe('ConfirmDni', () => {
  let fixture: ComponentFixture<ConfirmDni>;
  let el: HTMLElement;
  let confirmDni: ReturnType<typeof vi.fn<(dni: string, email: string) => Observable<void>>>;
  let router: Router;
  let user: FakeUser;

  function setup(result: () => Observable<void> = () => of(undefined)) {
    user = fakeUser({ email: 'Ana@Correo.com' });
    confirmDni = vi.fn(() => result());
    TestBed.configureTestingModule({
      imports: [ConfirmDni],
      providers: [
        provideRouter([]),
        provideFakeClerk(createFakeClerk({ user })),
        { provide: MeApi, useValue: { confirmDni, getMe: () => of() } },
      ],
    });
    router = TestBed.inject(Router);
    vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
    fixture = TestBed.createComponent(ConfirmDni);
    el = fixture.nativeElement;
    fixture.detectChanges();
  }

  const q = <T extends HTMLElement>(s: string) => el.querySelector(s) as T;
  const settle = () => new Promise<void>((r) => setTimeout(r, 0));

  function type(value: string) {
    const input = q<HTMLInputElement>('#cd-dni');
    input.value = value;
    input.dispatchEvent(new Event('input'));
    input.dispatchEvent(new Event('blur'));
    fixture.detectChanges();
  }
  const submit = () => {
    q<HTMLFormElement>('form').dispatchEvent(new Event('submit'));
    fixture.detectChanges();
  };

  it.each([['', 'obligatorio'], ['1234567', '8 dígitos'], ['123456789', '8 dígitos'], ['abcdefgh', '8 dígitos'], ['1234 678', '8 dígitos']])(
    'DNI "%s" muestra error y no consulta',
    (value, fragment) => {
      setup();
      type(value);
      submit();
      expect(q('[data-testid=dni-error]').textContent).toContain(fragment);
      expect(confirmDni).not.toHaveBeenCalled();
    },
  );

  it('DNI válido: comprueba con el correo del usuario, guarda en Clerk y entra', async () => {
    setup();
    type('12345678');
    submit();
    await settle();
    expect(confirmDni).toHaveBeenCalledWith('12345678', 'ana@correo.com');
    expect(user.updates).toContainEqual({ unsafeMetadata: { dni: '12345678' } });
    expect(TestBed.inject(AuthService).dni()).toBe('12345678');
    expect(router.navigateByUrl).toHaveBeenCalledWith('/cliente');
  });

  it('DNI de otra cuenta: error en el campo, no guarda ni navega y el botón sigue habilitado', () => {
    setup(() =>
      throwError(() => new ApiError(409, 'DNI_TAKEN', 'x', { dni: 'Este DNI ya está vinculado a otra cuenta.' })),
    );
    type('12345678');
    submit();
    expect(q('[data-testid=dni-error]').textContent).toContain('vinculado a otra cuenta');
    expect(user.updates).toEqual([]);
    expect(router.navigateByUrl).not.toHaveBeenCalled();
    expect(q<HTMLButtonElement>('[data-testid=confirm-dni-submit]').disabled).toBe(false);
  });

  it('DNI inexistente: error en el campo', () => {
    setup(() =>
      throwError(() => new ApiError(404, 'NOT_FOUND', 'x', { dni: 'Este DNI no está vinculado a ninguna cuenta de SmartGym.' })),
    );
    type('12345678');
    submit();
    expect(q('[data-testid=dni-error]').textContent).toContain('no está vinculado');
  });

  it('mientras comprueba no hay doble envío', () => {
    const pending = new Subject<void>();
    setup(() => pending);
    type('12345678');
    submit();
    submit();
    expect(confirmDni).toHaveBeenCalledTimes(1);
    expect(q<HTMLButtonElement>('[data-testid=confirm-dni-submit]').disabled).toBe(true);
    pending.complete();
  });

  it('si Clerk no puede guardar el DNI avisa con un toast y no navega', async () => {
    setup();
    user.update = async () => {
      throw new Error('clerk caído');
    };
    type('12345678');
    submit();
    await settle();
    expect(TestBed.inject(ToastService).toasts().map((t) => t.kind)).toEqual(['error']);
    expect(router.navigateByUrl).not.toHaveBeenCalled();
    fixture.detectChanges();
    expect(q<HTMLButtonElement>('[data-testid=confirm-dni-submit]').disabled).toBe(false);
  });
});
