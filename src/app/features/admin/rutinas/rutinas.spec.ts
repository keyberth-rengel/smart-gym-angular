import { HttpContext } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Observable, Subject, of, throwError } from 'rxjs';
import { CustomersApi } from '../../../core/api/customers.api';
import { IdentityApi } from '../../../core/api/identity.api';
import { RoutinesApi } from '../../../core/api/routines.api';
import { ApiError } from '../../../core/http/api-error';
import { SKIP_ERROR_TOAST } from '../../../core/http/error.interceptor';
import { Customer, Identity, RoutineHistoryItem, RoutinePlan } from '../../../core/models';
import { ConfirmService } from '../../../shared/ui/confirm/confirm.service';
import { ToastService } from '../../../shared/ui/toast/toast.service';
import { AdminRutinas } from './rutinas';

const err = (status: number, raw = '') => new ApiError(status, `HTTP_${status}`, raw, {}, raw);
const WEEK: RoutinePlan = {
  monday: 'Legs',
  tuesday: 'Chest',
  wednesday: 'Back',
  thursday: 'Shoulders',
  friday: 'Arms',
  saturday: 'Cardio',
};
const HISTORY: RoutineHistoryItem[] = [
  { created_at: '2026-07-14T10:00:00', plan: { ...WEEK, monday: 'Cardio' } },
  { created_at: '2026-09-08T09:15:00', plan: WEEK },
];
const NOT_LINKED = 'Este DNI no está vinculado a ninguna cuenta de SmartGym.';
const DNI = '74582136';

describe('AdminRutinas', () => {
  let fixture: ComponentFixture<AdminRutinas>;
  let el: HTMLElement;
  let history: ReturnType<
    typeof vi.fn<(dni: string, ctx?: HttpContext) => Observable<RoutineHistoryItem[]>>
  >;
  let assign: ReturnType<typeof vi.fn<(dni: string) => Observable<RoutinePlan>>>;
  let resolve: ReturnType<typeof vi.fn<(dni: string, ctx?: HttpContext) => Observable<Identity>>>;
  let confirm: ReturnType<
    typeof vi.fn<(o: { title: string; message: string }) => Promise<boolean>>
  >;
  let getByDni: ReturnType<typeof vi.fn<(dni: string, ctx?: HttpContext) => Observable<Customer>>>;
  let toasts: ToastService;

  function setup(
    o: {
      history?: (dni: string) => Observable<RoutineHistoryItem[]>;
      assign?: (dni: string) => Observable<RoutinePlan>;
      resolve?: (dni: string) => Observable<Identity>;
      confirm?: () => Promise<boolean>;
      customer?: (dni: string) => Observable<Customer>;
    } = {},
  ) {
    history = vi.fn((dni: string, _ctx?: HttpContext) => (o.history ?? (() => of(HISTORY)))(dni));
    assign = vi.fn(o.assign ?? (() => of(WEEK)));
    resolve = vi.fn((dni: string, _ctx?: HttpContext) =>
      (o.resolve ?? ((d: string) => of({ dni: d, email: 'carlos@x.com' })))(dni),
    );
    confirm = vi.fn(o.confirm ?? (() => Promise.resolve(true)));
    getByDni = vi.fn((dni: string, _ctx?: HttpContext) =>
      (o.customer ?? (() => of({ email: 'carlos@x.com', name: 'Carlos', age: 28 })))(dni),
    );
    TestBed.configureTestingModule({
      imports: [AdminRutinas],
      providers: [
        { provide: RoutinesApi, useValue: { history, assign } },
        { provide: IdentityApi, useValue: { resolve } },
        { provide: CustomersApi, useValue: { getByDni } },
        { provide: ConfirmService, useValue: { confirm } },
      ],
    });
    toasts = TestBed.inject(ToastService);
    fixture = TestBed.createComponent(AdminRutinas);
    el = fixture.nativeElement;
    fixture.detectChanges();
  }

  const q = <T extends HTMLElement>(s: string) => el.querySelector(s) as T;
  const flush = async () => {
    await fixture.whenStable();
    await new Promise((r) => setTimeout(r));
    fixture.detectChanges();
  };
  const type = (value: string) => {
    const input = q<HTMLInputElement>('[data-testid=dni-input]');
    input.value = value;
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  };
  const viewHistory = async (dni = DNI) => {
    type(dni);
    q<HTMLButtonElement>('[data-testid=dni-secondary]').click();
    await flush();
  };
  const doAssign = async (dni = DNI) => {
    type(dni);
    q<HTMLButtonElement>('[data-testid=dni-primary]').click();
    await flush();
  };
  const fieldError = () => q('[data-testid=dni-error]')?.textContent?.trim() ?? null;
  const failure = () => q('[data-testid=failure]')?.textContent?.trim() ?? null;
  const title = () => q('#active-title')?.textContent?.trim() ?? null;
  const toastTexts = () => toasts.toasts().map((t) => `${t.kind}:${t.message}`);

  it('al entrar: estado inicial de búsqueda y ninguna llamada', () => {
    setup();
    expect(el.textContent).toContain('Busca un cliente por su DNI');
    expect(history).not.toHaveBeenCalled();
    expect(q('[data-testid=active-card]')).toBeNull();
  });

  it('Enter en el campo consulta el historial y NUNCA asigna una rutina', async () => {
    setup();
    type(DNI);
    q<HTMLInputElement>('[data-testid=dni-input]').dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Enter' }),
    );
    await flush();
    expect(history).toHaveBeenCalledTimes(1);
    expect(assign).not.toHaveBeenCalled();
  });

  it('DNI inválido o vacío: no llama al API en ninguna acción', async () => {
    setup();
    await viewHistory('1234567');
    await doAssign('');
    await doAssign('123456789');
    expect(history).not.toHaveBeenCalled();
    expect(assign).not.toHaveBeenCalled();
  });

  describe('ver historial', () => {
    it('muestra la rutina activa (la última), el historial y el correo resuelto', async () => {
      setup();
      await viewHistory();
      expect(history).toHaveBeenCalledWith(DNI, expect.anything());
      expect(history.mock.calls[0][1]!.get(SKIP_ERROR_TOAST)).toBe(true);
      expect(title()).toBe('Rutina activa');
      expect(q('[data-testid=subject]').textContent).toContain('carlos@x.com');
      expect(q('app-plan-grid')!.textContent).toContain('Piernas');
      expect(el.textContent).toContain('Desde el 08 sep 2026');
      expect(q('app-routine-history')).not.toBeNull();
      expect(q('[data-testid=assign-success]')).toBeNull();
    });

    it('si no se puede resolver el correo, muestra el DNI', async () => {
      setup({ resolve: () => throwError(() => err(403)) });
      await viewHistory();
      expect(q('[data-testid=subject]').textContent).toContain(`DNI ${DNI}`);
    });

    it('sin rutinas: estado vacío', async () => {
      setup({ history: () => of([]) });
      await viewHistory();
      expect(el.textContent).toContain('Este cliente aún no tiene rutinas');
      expect(q('[data-testid=active-card]')).toBeNull();
    });

    it('sin rutinas y el DNI es de un cliente: no se muestra ningún aviso extra', async () => {
      setup({ history: () => of([]) });
      await viewHistory();
      expect(getByDni).toHaveBeenCalledWith(DNI, expect.anything());
      expect(getByDni.mock.calls[0][1]!.get(SKIP_ERROR_TOAST)).toBe(true);
      expect(failure()).toBeNull();
      expect(el.textContent).toContain('Este cliente aún no tiene rutinas');
    });

    it('lista vacía pero el DNI NO es de un cliente (p. ej. un entrenador): aviso claro y sin "este cliente aún no tiene rutinas"', async () => {
      setup({
        history: () => of([]),
        customer: () => throwError(() => err(404, 'Customer not found: lucia@x.com')),
      });
      await viewHistory();
      expect(failure()).toContain('no es de cliente');
      expect(el.textContent).not.toContain('Este cliente aún no tiene rutinas');
    });

    it('si la verificación del cliente falla por otra causa (500), se conserva el estado vacío', async () => {
      setup({ history: () => of([]), customer: () => throwError(() => err(500)) });
      await viewHistory();
      expect(failure()).toBeNull();
      expect(el.textContent).toContain('Este cliente aún no tiene rutinas');
    });

    it('con rutinas no hace la verificación extra', async () => {
      setup();
      await viewHistory();
      expect(getByDni).not.toHaveBeenCalled();
    });

    it('DNI no vinculado (404): error bajo el campo y sin resultado', async () => {
      setup({ history: () => throwError(() => err(404, 'DNI not linked')) });
      await viewHistory();
      expect(fieldError()).toBe(NOT_LINKED);
      expect(q('[data-testid=active-card]')).toBeNull();
      expect(el.textContent).toContain('Busca un cliente por su DNI');
    });

    it('DNI de una cuenta que no es cliente: aviso general, no error de campo', async () => {
      setup({ history: () => throwError(() => err(404, 'Customer not found: x@y.com')) });
      await viewHistory();
      expect(failure()).toContain('no es de cliente');
      expect(fieldError()).toBeNull();
    });

    it('un DNI inexistente después de uno válido limpia el resultado anterior', async () => {
      setup();
      await viewHistory();
      expect(q('[data-testid=active-card]')).not.toBeNull();
      history.mockReturnValue(throwError(() => err(404, 'DNI not linked')));
      await viewHistory('11111111');
      expect(q('[data-testid=active-card]')).toBeNull();
      expect(fieldError()).toBe(NOT_LINKED);
    });

    it('500: error con Reintentar, que vuelve a consultar el mismo DNI', async () => {
      setup({ history: () => throwError(() => err(500)) });
      await viewHistory();
      expect(el.textContent).toContain('No pudimos cargar la rutina');
      history.mockReturnValue(of(HISTORY));
      q<HTMLButtonElement>('[data-testid=retry]').click();
      await flush();
      expect(history).toHaveBeenLastCalledWith(DNI, expect.anything());
      expect(q('[data-testid=active-card]')).not.toBeNull();
    });

    it('403: aviso de permisos y estado de error', async () => {
      setup({ history: () => throwError(() => err(403)) });
      await viewHistory();
      expect(failure()).toBe('No tienes permisos para consultar las rutinas.');
      expect(q('[data-testid=retry]')).not.toBeNull();
    });

    it('escribir otro DNI limpia el error de campo', async () => {
      setup({ history: () => throwError(() => err(404, 'DNI not linked')) });
      await viewHistory();
      expect(fieldError()).toBe(NOT_LINKED);
      type('1');
      expect(fieldError()).not.toBe(NOT_LINKED);
    });

    it('mientras carga: esqueleto y botones deshabilitados', async () => {
      const gate = new Subject<RoutineHistoryItem[]>();
      setup({ history: () => gate });
      type(DNI);
      q<HTMLButtonElement>('[data-testid=dni-secondary]').click();
      fixture.detectChanges();
      expect(q('[data-testid=loading-card]')).not.toBeNull();
      expect(q<HTMLButtonElement>('[data-testid=dni-primary]').disabled).toBe(true);
      expect(q<HTMLButtonElement>('[data-testid=dni-secondary]').disabled).toBe(true);
      gate.next(HISTORY);
      gate.complete();
      await flush();
      expect(q<HTMLButtonElement>('[data-testid=dni-primary]').disabled).toBe(false);
    });
  });

  describe('asignar rutina', () => {
    it('a un DNI nuevo: sin confirmación, avisa, muestra "Rutina asignada a <correo>" y recarga', async () => {
      setup();
      await doAssign();
      expect(confirm).not.toHaveBeenCalled();
      expect(assign).toHaveBeenCalledWith(DNI);
      expect(toastTexts()).toEqual(['success:La nueva rutina semanal ya está activa.']);
      expect(q('[data-testid=assign-success]').textContent).toContain(
        'Rutina asignada a carlos@x.com.',
      );
      expect(title()).toBe('Rutina asignada');
      expect(history).toHaveBeenCalledTimes(1);
    });

    it('con una rutina activa mostrada para ese DNI: pide confirmación y respeta "Volver"', async () => {
      setup({ confirm: () => Promise.resolve(false) });
      await viewHistory();
      await doAssign();
      expect(confirm).toHaveBeenCalledTimes(1);
      expect(confirm.mock.calls[0][0].message).toContain('carlos@x.com');
      expect(assign).not.toHaveBeenCalled();
      expect(q<HTMLButtonElement>('[data-testid=dni-primary]').disabled).toBe(false);
    });

    it('confirmada: asigna y recarga el historial', async () => {
      setup();
      await viewHistory();
      await doAssign();
      expect(confirm).toHaveBeenCalledTimes(1);
      expect(assign).toHaveBeenCalledWith(DNI);
      expect(history).toHaveBeenCalledTimes(2);
      expect(title()).toBe('Rutina asignada');
    });

    it('con otro DNI distinto del mostrado no pide confirmación', async () => {
      setup();
      await viewHistory();
      await doAssign('11111111');
      expect(confirm).not.toHaveBeenCalled();
      expect(assign).toHaveBeenCalledWith('11111111');
    });

    it('DNI no vinculado (404): error de campo, sin toast de éxito ni recarga', async () => {
      setup({ assign: () => throwError(() => err(404, 'DNI not linked')) });
      await doAssign();
      expect(fieldError()).toBe(NOT_LINKED);
      expect(toastTexts()).toEqual([]);
      expect(history).not.toHaveBeenCalled();
    });

    it('DNI de una cuenta que no es cliente: aviso general', async () => {
      setup({ assign: () => throwError(() => err(404, 'Customer not found: x@y.com')) });
      await doAssign();
      expect(failure()).toContain('no es de cliente');
    });

    it('500 o 403: no muestra éxito (el toast lo pone el interceptor) y el botón queda libre', async () => {
      setup({ assign: () => throwError(() => err(500)) });
      await doAssign();
      expect(q('[data-testid=assign-success]')).toBeNull();
      expect(toastTexts()).toEqual([]);
      expect(q<HTMLButtonElement>('[data-testid=dni-primary]').disabled).toBe(false);
    });

    it('doble clic: una sola petición', async () => {
      const gate = new Subject<RoutinePlan>();
      setup({ assign: () => gate });
      type(DNI);
      const btn = q<HTMLButtonElement>('[data-testid=dni-primary]');
      btn.click();
      btn.click();
      await flush();
      expect(assign).toHaveBeenCalledTimes(1);
      expect(btn.disabled).toBe(true);
      gate.next(WEEK);
      gate.complete();
      await flush();
      expect(assign).toHaveBeenCalledTimes(1);
      expect(btn.disabled).toBe(false);
    });
  });
});
