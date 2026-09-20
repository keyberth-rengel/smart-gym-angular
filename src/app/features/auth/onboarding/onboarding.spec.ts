import { TestBed, ComponentFixture } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { Observable, Subject, of, throwError } from 'rxjs';
import { MeApi } from '../../../core/api/me.api';
import { AuthService } from '../../../core/auth/auth.service';
import { ApiError } from '../../../core/http/api-error';
import { OnboardingInput } from '../../../core/models';
import { ToastService } from '../../../shared/ui/toast/toast.service';
import { FakeUser, createFakeClerk, fakeUser, provideFakeClerk } from '../../../testing/fake-clerk';
import { Onboarding } from './onboarding';

describe('Onboarding', () => {
  let fixture: ComponentFixture<Onboarding>;
  let el: HTMLElement;
  let complete: ReturnType<typeof vi.fn<(i: OnboardingInput) => Observable<void>>>;
  let router: Router;
  let clerkUser: FakeUser;

  function setup(result: () => Observable<void> = () => of(undefined), name: string | null = 'Ana Pérez') {
    clerkUser = fakeUser({ name, email: 'Ana@Correo.com' });
    complete = vi.fn((_: OnboardingInput) => result());
    TestBed.configureTestingModule({
      imports: [Onboarding],
      providers: [
        provideRouter([]),
        provideFakeClerk(createFakeClerk({ user: clerkUser })),
        { provide: MeApi, useValue: { completeOnboarding: complete, getMe: () => of() } },
      ],
    });
    router = TestBed.inject(Router);
    vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
    fixture = TestBed.createComponent(Onboarding);
    el = fixture.nativeElement;
    fixture.detectChanges();
  }

  const q = <T extends HTMLElement>(sel: string) => el.querySelector(sel) as T;
  const text = (sel: string) => q(sel).textContent!.trim();
  const visible = (sel: string) => !q(sel).hidden;

  function type(id: 'ob-age' | 'ob-dni', value: string) {
    const input = q<HTMLInputElement>(`#${id}`);
    input.value = value;
    input.dispatchEvent(new Event('input'));
    input.dispatchEvent(new Event('blur'));
    fixture.detectChanges();
  }

  /** Espera a las promesas encadenadas de `finish()` (Clerk + navegación). */
  const settle = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

  const submit = () => {
    q<HTMLFormElement>('form').dispatchEvent(new Event('submit'));
    fixture.detectChanges();
  };

  const fill = (age = '28', dni = '12345678') => {
    type('ob-age', age);
    type('ob-dni', dni);
  };

  it('muestra el nombre de Clerk como solo lectura y el correo en minúsculas', () => {
    setup();
    const name = q<HTMLInputElement>('#ob-name');
    const email = q<HTMLInputElement>('#ob-email');
    expect(name.value).toBe('Ana Pérez');
    expect(email.value).toBe('ana@correo.com');
    expect(name.readOnly).toBe(true);
    expect(email.readOnly).toBe(true);
  });

  describe('nombre', () => {
    const typeName = (value: string) => {
      const input = q<HTMLInputElement>('#ob-name');
      input.value = value;
      input.dispatchEvent(new Event('input'));
      input.dispatchEvent(new Event('blur'));
      fixture.detectChanges();
    };

    it('si Clerk no tiene nombre, el campo es editable y obligatorio', () => {
      setup(undefined, null);
      expect(q<HTMLInputElement>('#ob-name').readOnly).toBe(false);
      fill();
      submit();
      expect(text('[data-testid=name-error]')).toBe('Este campo es obligatorio.');
      expect(complete).not.toHaveBeenCalled();
    });

    it.each([
      ['A', 'Mínimo 2 caracteres.'],
      ['Ana <b>', 'No puede contener los caracteres < o >.'],
      ['x'.repeat(121), 'Máximo 120 caracteres.'],
    ])('"%s" -> %s', (value, message) => {
      setup(undefined, null);
      typeName(value);
      fill();
      submit();
      expect(text('[data-testid=name-error]')).toBe(message);
      expect(complete).not.toHaveBeenCalled();
    });

    it('envía el nombre escrito (sin espacios sobrantes) y lo guarda en Clerk', async () => {
      setup(undefined, null);
      typeName('  Luis Ramírez Soto ');
      fill();
      submit();
      expect(complete).toHaveBeenCalledWith(expect.objectContaining({ name: 'Luis Ramírez Soto' }));
      await vi.waitFor(() =>
        expect(clerkUser.updates).toEqual([{ firstName: 'Luis', lastName: 'Ramírez Soto' }]),
      );
    });

    it('si Clerk ya tiene nombre no lo vuelve a guardar', () => {
      setup();
      fill();
      submit();
      expect(clerkUser.updates).toEqual([]);
    });
  });

  it('formulario vacío: no envía y marca ambos campos como obligatorios', () => {
    setup();
    submit();
    expect(complete).not.toHaveBeenCalled();
    expect(text('[data-testid=age-error]')).toBe('Este campo es obligatorio.');
    expect(text('[data-testid=dni-error]')).toBe('Este campo es obligatorio.');
    expect(q('#ob-age').getAttribute('aria-invalid')).toBe('true');
  });

  it('no muestra errores antes de que el usuario interactúe', () => {
    setup();
    expect(visible('[data-testid=age-error]')).toBe(false);
    expect(visible('[data-testid=dni-error]')).toBe(false);
  });

  describe('DNI', () => {
    it.each(['1234567', '123456789', '1234567a', 'abcdefgh', '1234 567'])('"%s" no es válido', (dni) => {
      setup();
      fill('28', dni);
      submit();
      expect(text('[data-testid=dni-error]')).toBe('El DNI debe tener 8 dígitos.');
      expect(complete).not.toHaveBeenCalled();
    });

    it('8 dígitos es válido', () => {
      setup();
      fill('28', '12345678');
      submit();
      expect(visible('[data-testid=dni-error]')).toBe(false);
      expect(complete).toHaveBeenCalledTimes(1);
    });
  });

  describe('edad', () => {
    it.each([
      ['-5', 'Debe ser mayor o igual a 14.'],
      ['0', 'Debe ser mayor o igual a 14.'],
      ['13', 'Debe ser mayor o igual a 14.'],
      ['101', 'Debe ser menor o igual a 100.'],
      ['abc', 'Ingresa un número entero.'],
      ['28.5', 'Ingresa un número entero.'],
    ])('"%s" -> %s', (age, message) => {
      setup();
      fill(age);
      submit();
      expect(text('[data-testid=age-error]')).toBe(message);
      expect(complete).not.toHaveBeenCalled();
    });

    it.each(['14', '100', '28'])('"%s" es válida', (age) => {
      setup();
      fill(age);
      submit();
      expect(visible('[data-testid=age-error]')).toBe(false);
      expect(complete).toHaveBeenCalledTimes(1);
    });
  });

  it('datos válidos: envía el payload, guarda el DNI en Clerk, avisa y navega al inicio del cliente', async () => {
    setup();
    const toast = TestBed.inject(ToastService);
    fill('28', '12345678');
    submit();
    await settle();

    expect(complete).toHaveBeenCalledWith({
      name: 'Ana Pérez',
      email: 'ana@correo.com',
      age: 28,
      dni: '12345678',
    });
    const auth = TestBed.inject(AuthService);
    expect(auth.profileComplete()).toBe(true);
    expect(auth.dni()).toBe('12345678');
    expect(clerkUser.updates).toContainEqual({ unsafeMetadata: { dni: '12345678' } });
    expect(toast.toasts().map((t) => t.kind)).toEqual(['success']);
    expect(router.navigateByUrl).toHaveBeenCalledWith('/cliente');
  });

  it('si Clerk falla al guardar el DNI, igual entra (luego se confirma en /auth/confirm-dni)', async () => {
    setup();
    clerkUser.update = async () => {
      throw new Error('clerk caído');
    };
    fill('28', '12345678');
    submit();
    await settle();
    expect(router.navigateByUrl).toHaveBeenCalledWith('/cliente');
  });

  it('mientras envía, el botón queda deshabilitado y no hay doble envío', () => {
    const pending = new Subject<void>();
    setup(() => pending);
    fill();
    submit();
    expect(q<HTMLButtonElement>('[data-testid=onboarding-submit]').disabled).toBe(true);
    submit();
    expect(complete).toHaveBeenCalledTimes(1);
    expect(text('[data-testid=onboarding-submit]')).toContain('Guardando');

    pending.next();
    pending.complete();
    fixture.detectChanges();
  });

  it('DNI de otra cuenta: error en el campo, botón habilitado y sin navegar', () => {
    setup(() =>
      throwError(() => new ApiError(409, 'DNI_TAKEN', 'Este DNI ya está vinculado a otra cuenta.', { dni: 'Este DNI ya está vinculado a otra cuenta.' })),
    );
    fill();
    submit();
    expect(text('[data-testid=dni-error]')).toBe('Este DNI ya está vinculado a otra cuenta.');
    expect(q<HTMLButtonElement>('[data-testid=onboarding-submit]').disabled).toBe(false);
    expect(router.navigateByUrl).not.toHaveBeenCalled();
  });

  it('el error del servidor desaparece al corregir el campo', () => {
    setup(() => throwError(() => new ApiError(409, 'DNI_TAKEN', 'x', { dni: 'Este DNI ya está vinculado a otra cuenta.' })));
    fill();
    submit();
    expect(visible('[data-testid=dni-error]')).toBe(true);
    type('ob-dni', '87654321');
    expect(visible('[data-testid=dni-error]')).toBe(false);
  });

  it('400 con campo desconocido: toast y el formulario sigue utilizable', () => {
    setup(() => throwError(() => new ApiError(400, 'BAD_REQUEST', 'Revisa los datos ingresados.', { nickname: 'Este campo es obligatorio.' })));
    fill();
    submit();
    expect(TestBed.inject(ToastService).toasts()[0].message).toBe('Revisa los datos ingresados.');
    expect(q<HTMLButtonElement>('[data-testid=onboarding-submit]').disabled).toBe(false);
  });

  it('servicio caído (5xx): sin errores de campo y se puede reintentar', () => {
    setup(() => throwError(() => new ApiError(500, 'HTTP_500', 'El servicio no está disponible.')));
    fill();
    submit();
    expect(visible('[data-testid=dni-error]')).toBe(false);
    expect(q<HTMLButtonElement>('[data-testid=onboarding-submit]').disabled).toBe(false);
    expect(router.navigateByUrl).not.toHaveBeenCalled();
  });
});
