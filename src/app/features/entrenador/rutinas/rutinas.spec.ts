import { HttpContext } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { Observable, Subject, of, throwError } from 'rxjs';
import { MeApi } from '../../../core/api/me.api';
import { RoutinesApi } from '../../../core/api/routines.api';
import { TrainersApi } from '../../../core/api/trainers.api';
import { AuthService } from '../../../core/auth/auth.service';
import { ApiError } from '../../../core/http/api-error';
import { RoutineHistoryItem, RoutinePlan, TrainerCustomer } from '../../../core/models';
import { ConfirmService } from '../../../shared/ui/confirm/confirm.service';
import { ToastService } from '../../../shared/ui/toast/toast.service';
import { createFakeClerk, fakeUser, provideFakeClerk } from '../../../testing/fake-clerk';
import { testMe } from '../../../testing/test-me';
import { EntrenadorRutinas } from './rutinas';

const err = (status: number, raw = '') => new ApiError(status, `HTTP_${status}`, raw, {}, raw);
const customer = (email: string, name: string): TrainerCustomer => ({
  email,
  name,
  age: 30,
  sessions: 1,
  last_booking_date: '2026-09-12',
  last_booking_time: '17:00',
});
const CUSTOMERS = [
  customer('carlos@correo.com', 'Carlos Mendoza'),
  customer('diego@correo.com', 'Diego Quispe'),
];
const WEEK = {
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

describe('EntrenadorRutinas', () => {
  let fixture: ComponentFixture<EntrenadorRutinas>;
  let el: HTMLElement;
  let customers: ReturnType<typeof vi.fn<(email: string) => Observable<TrainerCustomer[]>>>;
  let history: ReturnType<
    typeof vi.fn<(email: string, ctx?: HttpContext) => Observable<RoutineHistoryItem[]>>
  >;
  let assign: ReturnType<
    typeof vi.fn<(email: string, ctx?: HttpContext) => Observable<RoutinePlan>>
  >;
  let confirm: ReturnType<
    typeof vi.fn<(o: { title: string; message: string }) => Promise<boolean>>
  >;
  let toasts: ToastService;

  function setup(
    o: {
      cliente?: string;
      customers?: () => Observable<TrainerCustomer[]>;
      history?: (email: string) => Observable<RoutineHistoryItem[]>;
      assign?: () => Observable<RoutinePlan>;
      confirm?: () => Promise<boolean>;
    } = {},
  ) {
    customers = vi.fn(o.customers ?? (() => of(CUSTOMERS)));
    history = vi.fn(o.history ?? (() => of(HISTORY)));
    assign = vi.fn(o.assign ?? (() => of(WEEK)));
    confirm = vi.fn(o.confirm ?? (() => Promise.resolve(true)));
    TestBed.configureTestingModule({
      imports: [EntrenadorRutinas],
      providers: [
        provideFakeClerk(
          createFakeClerk({
            user: fakeUser({ email: 'lucia@smartgym.pe', name: 'Lucía Paredes' }),
          }),
        ),
        { provide: MeApi, useValue: {} },
        { provide: TrainersApi, useValue: { customers } },
        { provide: RoutinesApi, useValue: { historyByEmail: history, assignByEmail: assign } },
        { provide: ConfirmService, useValue: { confirm } },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: { queryParamMap: convertToParamMap(o.cliente ? { cliente: o.cliente } : {}) },
          },
        },
      ],
    });
    TestBed.inject(AuthService).applyMe(
      testMe({ role: 'entrenador', email: 'lucia@smartgym.pe', name: 'Lucía Paredes' }),
    );
    toasts = TestBed.inject(ToastService);
    fixture = TestBed.createComponent(EntrenadorRutinas);
    el = fixture.nativeElement;
    fixture.detectChanges();
  }

  const q = <T extends HTMLElement>(s: string) => el.querySelector(s) as T;
  const qa = (s: string) => Array.from(el.querySelectorAll<HTMLElement>(s));
  const txt = (s: string) => q(s).textContent!.replace(/\s+/g, ' ').trim();
  const flush = async () => {
    for (let i = 0; i < 4; i++) await fixture.whenStable();
    fixture.detectChanges();
  };
  const choose = (email: string) => {
    const select = q<HTMLSelectElement>('[data-testid=client-select]');
    select.value = email;
    select.dispatchEvent(new Event('change'));
    fixture.detectChanges();
  };
  const assignBtn = () => q<HTMLButtonElement>('[data-testid=assign]');
  const clickAssign = async () => {
    assignBtn().click();
    fixture.detectChanges();
    await flush();
  };
  const toastMessages = () => toasts.toasts().map((t) => `${t.kind}:${t.message}`);

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 8, 19, 15, 10));
  });
  afterEach(() => vi.useRealTimers());

  describe('elegir cliente', () => {
    it('pide los clientes del entrenador y, sin elección, pide que elijas uno y deshabilita asignar', () => {
      setup();
      expect(customers).toHaveBeenCalledWith('lucia@smartgym.pe');
      expect(q('[data-testid=empty-state]').textContent).toContain('Elige un cliente');
      expect(assignBtn().disabled).toBe(true);
      expect(history).not.toHaveBeenCalled();
      const options = qa('[data-testid=client-select] option').map((o) => o.textContent!.trim());
      expect(options).toEqual([
        'Elige un cliente',
        'Carlos Mendoza · carlos@correo.com',
        'Diego Quispe · diego@correo.com',
      ]);
    });

    it('?cliente=<correo> preselecciona (sin distinguir mayúsculas) y carga su historial', () => {
      setup({ cliente: 'DIEGO@correo.com' });
      expect(q<HTMLSelectElement>('[data-testid=client-select]').value).toBe('diego@correo.com');
      expect(history).toHaveBeenCalledWith('diego@correo.com', expect.anything());
      expect(assignBtn().disabled).toBe(false);
    });

    it('?cliente= de alguien que no es su cliente se ignora', () => {
      setup({ cliente: 'ajeno@correo.com' });
      expect(history).not.toHaveBeenCalled();
      expect(q('[data-testid=empty-state]').textContent).toContain('Elige un cliente');
    });

    it('al elegir un cliente muestra su rutina activa e historial', () => {
      setup();
      choose('carlos@correo.com');
      expect(history).toHaveBeenCalledTimes(1);
      expect(txt('[data-testid=active-card]')).toContain('Desde el 08 sep 2026');
      const cells = qa('[data-testid=active-card] [data-testid=plan-cell]').map(
        (c) =>
          `${c.querySelector('.plan-day')!.textContent!.trim()} ${c.querySelector('.plan-block')!.textContent!.trim()}`,
      );
      expect(cells).toEqual([
        'Lunes Piernas',
        'Martes Pecho',
        'Miércoles Espalda',
        'Jueves Hombros',
        'Viernes Brazos',
        'Sábado Cardio',
      ]);
      const rows = qa('[data-testid=history-row]').map((r) =>
        r.querySelector('.hist-date')!.textContent!.trim(),
      );
      expect(rows).toEqual(['08 sep 2026', '14 jul 2026']);
      expect(qa('[data-testid=history-row] .sg-badge').map((b) => b.textContent!.trim())).toEqual([
        'Activa',
        'Anterior',
      ]);
    });

    it('volver a "Elige un cliente" limpia todo', () => {
      setup({ cliente: 'carlos@correo.com' });
      choose('');
      expect(q('[data-testid=empty-state]').textContent).toContain('Elige un cliente');
      expect(assignBtn().disabled).toBe(true);
    });

    it('cambiar de cliente pide el historial del nuevo y borra el aviso anterior', async () => {
      setup({ cliente: 'carlos@correo.com' });
      await clickAssign();
      expect(q('[data-testid=assign-success]')).not.toBeNull();
      choose('diego@correo.com');
      expect(q('[data-testid=assign-success]')).toBeNull();
      expect(history).toHaveBeenLastCalledWith('diego@correo.com', expect.anything());
    });

    it('una respuesta tardía del cliente anterior no pisa la del elegido', () => {
      const first = new Subject<RoutineHistoryItem[]>();
      const second = new Subject<RoutineHistoryItem[]>();
      setup({ history: (email) => (email === 'carlos@correo.com' ? first : second) });
      choose('carlos@correo.com');
      choose('diego@correo.com');
      second.next([{ created_at: '2026-09-01T10:00:00', plan: { monday: 'Arms' } }]);
      second.complete();
      fixture.detectChanges();
      first.next(HISTORY);
      first.complete();
      fixture.detectChanges();
      expect(qa('[data-testid=history-row]')).toHaveLength(1);
      expect(txt('[data-testid=active-card]')).toContain('Desde el 01 sep 2026');
    });
  });

  describe('estado del historial', () => {
    it('cliente sin rutina: estado vacío y se puede asignar sin confirmación', async () => {
      setup({ cliente: 'carlos@correo.com', history: () => of([]) });
      expect(q('[data-testid=empty-state]').textContent).toContain('aún no tiene rutina');
      expect(assignBtn().disabled).toBe(false);
      await clickAssign();
      expect(confirm).not.toHaveBeenCalled();
      expect(assign).toHaveBeenCalledTimes(1);
      expect(assign).toHaveBeenCalledWith('carlos@correo.com', expect.anything());
    });

    it('un "no encontrado" (404) se ve como sin rutina', () => {
      setup({ cliente: 'carlos@correo.com', history: () => throwError(() => err(404)) });
      expect(q('[data-testid=empty-state]').textContent).toContain('aún no tiene rutina');
    });

    it('403: "Sin acceso a este cliente" y asignar deshabilitado', () => {
      setup({ cliente: 'carlos@correo.com', history: () => throwError(() => err(403)) });
      expect(q('[data-testid=empty-state]').textContent).toContain('Sin acceso a este cliente');
      expect(assignBtn().disabled).toBe(true);
    });

    it('500: error con "Reintentar" que se recupera', () => {
      let fail = true;
      setup({
        cliente: 'carlos@correo.com',
        history: () => (fail ? throwError(() => err(500)) : of(HISTORY)),
      });
      expect(q('[data-testid=history-retry]')).not.toBeNull();
      fail = false;
      q<HTMLButtonElement>('[data-testid=history-retry]').click();
      fixture.detectChanges();
      expect(history).toHaveBeenCalledTimes(2);
      expect(q('[data-testid=active-card]')).not.toBeNull();
    });

    it('esqueleto mientras carga', () => {
      setup({ cliente: 'carlos@correo.com', history: () => new Subject<RoutineHistoryItem[]>() });
      expect(q('[data-testid=loading-card]')).not.toBeNull();
    });
  });

  describe('asignar rutina', () => {
    it('con rutina activa pide confirmación con el nombre; al aceptar asigna, avisa y recarga el historial', async () => {
      setup({ cliente: 'carlos@correo.com' });
      await clickAssign();
      expect(confirm).toHaveBeenCalledTimes(1);
      const msg = confirm.mock.calls[0][0].message;
      expect(msg).toContain('Carlos Mendoza');
      expect(msg).toContain('reemplazará la rutina activa');
      expect(assign).toHaveBeenCalledTimes(1);
      expect(assign).toHaveBeenCalledWith('carlos@correo.com', expect.anything());
      expect(txt('[data-testid=assign-success]')).toContain('Rutina asignada el 19 sep 2026.');
      expect(toastMessages()).toEqual(['success:Le asignaste una nueva rutina a Carlos Mendoza.']);
      expect(history).toHaveBeenCalledTimes(2);
      expect(assignBtn().disabled).toBe(false);
    });

    it('al cancelar la confirmación no se asigna nada y el botón queda libre', async () => {
      setup({ cliente: 'carlos@correo.com', confirm: () => Promise.resolve(false) });
      await clickAssign();
      expect(assign).not.toHaveBeenCalled();
      expect(q('[data-testid=assign-success]')).toBeNull();
      expect(assignBtn().disabled).toBe(false);
      expect(history).toHaveBeenCalledTimes(1);
    });

    it('doble clic: una sola petición', async () => {
      const pending = new Subject<RoutinePlan>();
      setup({ cliente: 'carlos@correo.com', assign: () => pending });
      assignBtn().click();
      assignBtn().click();
      fixture.detectChanges();
      await flush();
      expect(confirm).toHaveBeenCalledTimes(1);
      expect(assign).toHaveBeenCalledTimes(1);
      expect(assignBtn().disabled).toBe(true);
      expect(assignBtn().textContent).toContain('Asignando');
      pending.next(WEEK);
      pending.complete();
      await flush();
      expect(assignBtn().disabled).toBe(false);
    });

    it('durante la confirmación el botón sigue habilitado (el diálogo devuelve el foco a un control activo) y un segundo clic no abre otra', async () => {
      let answer!: (ok: boolean) => void;
      setup({
        cliente: 'carlos@correo.com',
        confirm: () => new Promise<boolean>((r) => (answer = r)),
      });
      assignBtn().click();
      fixture.detectChanges();
      expect(assignBtn().disabled).toBe(false);
      assignBtn().click();
      expect(confirm).toHaveBeenCalledTimes(1);
      answer(false);
      await flush();
      expect(assign).not.toHaveBeenCalled();
      expect(assignBtn().disabled).toBe(false);
    });

    it('tras enviar, si el foco se perdió (botón deshabilitado), vuelve al botón "Asignar"', async () => {
      const pending = new Subject<RoutinePlan>();
      setup({ cliente: 'carlos@correo.com', assign: () => pending });
      document.body.appendChild(el);
      assignBtn().focus();
      assignBtn().click();
      fixture.detectChanges();
      await flush();
      (document.activeElement as HTMLElement | null)?.blur();
      pending.next(WEEK);
      pending.complete();
      await flush();
      expect(document.activeElement).toBe(assignBtn());
    });

    it('sin cliente elegido no hace nada', async () => {
      setup();
      assignBtn().click();
      await flush();
      expect(assign).not.toHaveBeenCalled();
      expect(confirm).not.toHaveBeenCalled();
    });

    it('403: mensaje claro en pantalla y sin toast duplicado', async () => {
      setup({ cliente: 'carlos@correo.com', assign: () => throwError(() => err(403)) });
      await clickAssign();
      expect(txt('[data-testid=assign-failure]')).toContain('solo a quienes han reservado contigo');
      expect(toastMessages()).toEqual([]);
      expect(q('[data-testid=assign-success]')).toBeNull();
      expect(assignBtn().disabled).toBe(false);
    });

    it('404: "No encontramos a este cliente"', async () => {
      setup({ cliente: 'carlos@correo.com', assign: () => throwError(() => err(404)) });
      await clickAssign();
      expect(txt('[data-testid=assign-failure]')).toContain('No encontramos a este cliente');
    });

    it('400: solicitud no válida', async () => {
      setup({ cliente: 'carlos@correo.com', assign: () => throwError(() => err(400)) });
      await clickAssign();
      expect(txt('[data-testid=assign-failure]')).toContain('La solicitud no es válida');
    });

    it('500 y red caída: toast (no mensaje en pantalla) y el botón se libera', async () => {
      setup({ cliente: 'carlos@correo.com', assign: () => throwError(() => err(500)) });
      await clickAssign();
      expect(q('[data-testid=assign-failure]')).toBeNull();
      expect(toasts.toasts()).toHaveLength(1);
      expect(toasts.toasts()[0].kind).toBe('error');
      expect(assignBtn().disabled).toBe(false);

      TestBed.resetTestingModule();
      setup({ cliente: 'carlos@correo.com', assign: () => throwError(() => err(0)) });
      await clickAssign();
      expect(toasts.toasts()[0].title).toBe('Servicio no disponible');
    });

    it('un fallo al asignar no borra la rutina que se estaba viendo', async () => {
      setup({ cliente: 'carlos@correo.com', assign: () => throwError(() => err(403)) });
      await clickAssign();
      expect(q('[data-testid=active-card]')).not.toBeNull();
      expect(history).toHaveBeenCalledTimes(1);
    });
  });

  describe('lista de clientes', () => {
    it('sin clientes: estado vacío y nada para elegir', () => {
      setup({ customers: () => of([]) });
      expect(q('[data-testid=empty-state]').textContent).toContain('Aún no tienes clientes');
      expect(q('[data-testid=client-select]')).toBeNull();
    });

    it('esqueleto mientras carga', () => {
      setup({ customers: () => new Subject<TrainerCustomer[]>() });
      expect(q('[data-testid=loading-card]')).not.toBeNull();
    });

    it('error: "Reintentar" y, al recuperarse, aplica el cliente de la URL', () => {
      let fail = true;
      setup({
        cliente: 'carlos@correo.com',
        customers: () => (fail ? throwError(() => err(500)) : of(CUSTOMERS)),
      });
      expect(q('[data-testid=retry]')).not.toBeNull();
      fail = false;
      q<HTMLButtonElement>('[data-testid=retry]').click();
      fixture.detectChanges();
      expect(customers).toHaveBeenCalledTimes(2);
      expect(q<HTMLSelectElement>('[data-testid=client-select]').value).toBe('carlos@correo.com');
      expect(history).toHaveBeenCalledTimes(1);
    });
  });
});
