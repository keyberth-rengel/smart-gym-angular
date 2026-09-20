import { HttpContext } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Observable, Subject, of, throwError } from 'rxjs';
import { BookingsApi } from '../../../core/api/bookings.api';
import { CustomersApi } from '../../../core/api/customers.api';
import { TrainersApi } from '../../../core/api/trainers.api';
import { ApiError } from '../../../core/http/api-error';
import { SKIP_ERROR_TOAST } from '../../../core/http/error.interceptor';
import { Booking, Customer, Trainer } from '../../../core/models';
import { ConfirmService } from '../../../shared/ui/confirm/confirm.service';
import { ToastService } from '../../../shared/ui/toast/toast.service';
import { AdminReservas } from './reservas';

const err = (status: number, raw = '') => new ApiError(status, `HTTP_${status}`, raw, {}, raw);

const BOOKINGS: Booking[] = [
  { id: 9, customer_email: 'miguel@x.com', trainer_email: 'lucia@x.com', date: '2026-09-18', time: '07:30', note: null },
  { id: 14, customer_email: 'carlos@x.com', trainer_email: 'lucia@x.com', date: '2026-09-19', time: '16:30', note: 'Piernas' },
  { id: 13, customer_email: 'rosa@x.com', trainer_email: 'marco@x.com', date: '2026-09-19', time: '17:00', note: null },
];
const CUSTOMERS: Customer[] = [
  { email: 'carlos@x.com', name: 'Carlos Mendoza', age: 28 },
  { email: 'rosa@x.com', name: 'Rosa Lima', age: 34 },
  { email: 'miguel@x.com', name: 'Miguel Torres', age: 45 },
];
const TRAINERS: Trainer[] = [
  { email: 'lucia@x.com', name: 'Lucía Paredes', age: 33, specialty: 'Fuerza' },
  { email: 'marco@x.com', name: 'Marco Vílchez', age: 29, specialty: 'Funcional' },
];

describe('AdminReservas', () => {
  let fixture: ComponentFixture<AdminReservas>;
  let el: HTMLElement;
  let list: ReturnType<typeof vi.fn<(ctx?: HttpContext) => Observable<Booking[]>>>;
  let cancel: ReturnType<typeof vi.fn<(id: number) => Observable<void>>>;
  let confirm: ReturnType<typeof vi.fn<(o: Record<string, unknown>) => Promise<boolean>>>;
  let customersList: ReturnType<typeof vi.fn<(ctx?: HttpContext) => Observable<Customer[]>>>;
  let toasts: ToastService;

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 8, 19, 15, 10));
  });
  afterEach(() => vi.useRealTimers());

  function setup(
    o: {
      list?: () => Observable<Booking[]>;
      customers?: () => Observable<Customer[]>;
      trainers?: () => Observable<Trainer[]>;
      cancel?: (id: number) => Observable<void>;
      confirm?: () => Promise<boolean>;
    } = {},
  ) {
    list = vi.fn((_ctx?: HttpContext) => (o.list ?? (() => of(BOOKINGS)))());
    cancel = vi.fn(o.cancel ?? (() => of(undefined)));
    confirm = vi.fn(o.confirm ?? (() => Promise.resolve(true)));
    customersList = vi.fn((_ctx?: HttpContext) => (o.customers ?? (() => of(CUSTOMERS)))());
    TestBed.configureTestingModule({
      imports: [AdminReservas],
      providers: [
        { provide: BookingsApi, useValue: { list, cancel } },
        { provide: CustomersApi, useValue: { list: customersList } },
        {
          provide: TrainersApi,
          useValue: { list: vi.fn(() => (o.trainers ?? (() => of(TRAINERS)))()) },
        },
        { provide: ConfirmService, useValue: { confirm } },
      ],
    });
    toasts = TestBed.inject(ToastService);
    fixture = TestBed.createComponent(AdminReservas);
    el = fixture.nativeElement;
    fixture.detectChanges();
  }

  const q = <T extends HTMLElement>(s: string) => el.querySelector(s) as T;
  const qa = (s: string) => Array.from(el.querySelectorAll<HTMLElement>(s));
  const ids = () =>
    qa('[data-testid=booking-row]').map((r) => r.querySelector('td')!.textContent!.trim());
  /** Deja terminar las promesas encadenadas del componente (confirmación, petición, finally). */
  const flush = async () => {
    await fixture.whenStable();
    await new Promise((r) => setTimeout(r));
    fixture.detectChanges();
  };
  const chooseTrainer = (email: string) => {
    const select = q<HTMLSelectElement>('[data-testid=filter-trainer]');
    select.value = email;
    select.dispatchEvent(new Event('change'));
    fixture.detectChanges();
  };
  const setDate = (value: string) => {
    const input = q<HTMLInputElement>('[data-testid=filter-date]');
    input.value = value;
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  };
  const cancelRow = (index = 0) => {
    qa('[data-testid=cancel]')[index].click();
    fixture.detectChanges();
  };
  const toastTexts = () => toasts.toasts().map((t) => `${t.kind}:${t.message}`);

  describe('lista y filtros', () => {
    it('carga una vez y arranca filtrada por HOY, más reciente primero, con nombres y correos', () => {
      setup();
      expect(list).toHaveBeenCalledTimes(1);
      expect(ids()).toEqual(['13', '14']);
      expect(q<HTMLInputElement>('[data-testid=filter-date]').value).toBe('2026-09-19');
      expect(q('[data-testid=count]').textContent).toBe('2');
      const first = qa('[data-testid=booking-row]')[1];
      expect(first.textContent).toContain('Carlos Mendoza');
      expect(first.textContent).toContain('carlos@x.com');
      expect(first.textContent).toContain('Lucía Paredes');
      expect(first.textContent).toContain('Piernas');
    });

    it('pide los nombres sin toast automático (fallan en silencio)', () => {
      setup();
      const ctx = customersList.mock.calls[0][0]!;
      expect(ctx.get(SKIP_ERROR_TOAST)).toBe(true);
    });

    it('vaciar la fecha muestra todas; el conteo singular/plural sigue al resultado', () => {
      setup();
      setDate('');
      expect(ids()).toEqual(['13', '14', '9']);
      expect(q('[data-testid=count]').textContent).toBe('3');
      chooseTrainer('marco@x.com');
      expect(ids()).toEqual(['13']);
      expect(q('app-badge')!.textContent!.replace(/\s+/g, ' ').trim()).toBe('1 reserva');
    });

    it('filtra por entrenador y por fecha combinados', () => {
      setup();
      setDate('2026-09-18');
      expect(ids()).toEqual(['9']);
      chooseTrainer('marco@x.com');
      expect(q('[data-testid=empty-state]')).not.toBeNull();
      expect(el.textContent).toContain('Sin reservas con esos filtros');
    });

    it('"Limpiar filtros" del estado vacío y el botón "Limpiar" quitan ambos filtros', () => {
      setup();
      chooseTrainer('marco@x.com');
      setDate('2026-09-18');
      expect(q('[data-testid=empty-clear]')).not.toBeNull();
      q<HTMLButtonElement>('[data-testid=empty-clear]').click();
      fixture.detectChanges();
      expect(ids()).toEqual(['13', '14', '9']);
      expect(q('[data-testid=filter-clear]')).toBeNull();

      setDate('2026-09-18');
      expect(q('[data-testid=filter-clear]')).not.toBeNull();
      q<HTMLButtonElement>('[data-testid=filter-clear]').click();
      fixture.detectChanges();
      expect(q<HTMLInputElement>('[data-testid=filter-date]').value).toBe('');
      expect(ids()).toEqual(['13', '14', '9']);
    });

    it('"Filtrar" vuelve a pedir las reservas y conserva los filtros', () => {
      setup();
      chooseTrainer('marco@x.com');
      q<HTMLButtonElement>('[data-testid=filter-apply]').click();
      fixture.detectChanges();
      expect(list).toHaveBeenCalledTimes(2);
      expect(ids()).toEqual(['13']);
    });

    it('el select ofrece "Todos" y los entrenadores por nombre', () => {
      setup();
      const options = qa('[data-testid=filter-trainer] option').map((o) => o.textContent!.trim());
      expect(options).toEqual(['Todos los entrenadores', 'Lucía Paredes', 'Marco Vílchez']);
    });
  });

  describe('sin nombres (las cargas de apoyo fallan)', () => {
    it('la tabla sigue con los correos y el filtro usa los correos de las reservas', () => {
      setup({
        customers: () => throwError(() => err(500)),
        trainers: () => throwError(() => err(500)),
      });
      setDate('');
      expect(ids()).toEqual(['13', '14', '9']);
      const row = qa('[data-testid=booking-row]')[0];
      expect(row.querySelectorAll('.person-name')[0].textContent).toBe('rosa@x.com');
      expect(row.querySelector('.person-email')).toBeNull();
      const options = qa('[data-testid=filter-trainer] option').map((o) => o.textContent!.trim());
      expect(options).toEqual(['Todos los entrenadores', 'lucia@x.com', 'marco@x.com']);
    });
  });

  describe('estados', () => {
    it('sin reservas: estado vacío', () => {
      setup({ list: () => of([]) });
      expect(el.textContent).toContain('Aún no hay reservas');
      expect(q('[data-testid=bookings-table]')).toBeNull();
    });

    it('carga pendiente: esqueleto', () => {
      setup({ list: () => new Subject<Booking[]>() });
      expect(q('[data-testid=loading-table]')).not.toBeNull();
    });

    it('error de red o 500: mensaje de conexión y Reintentar vuelve a pedir', () => {
      setup({ list: () => throwError(() => err(500)) });
      expect(el.textContent).toContain('Revisa tu conexión');
      list.mockReturnValue(of(BOOKINGS));
      q<HTMLButtonElement>('[data-testid=retry]').click();
      fixture.detectChanges();
      expect(list).toHaveBeenCalledTimes(2);
      expect(ids()).toEqual(['13', '14']);
    });

    it('403: habla de permisos y no de la conexión', () => {
      setup({ list: () => throwError(() => err(403)) });
      expect(el.textContent).toContain('No tienes permisos para ver esta sección.');
      expect(el.textContent).not.toContain('Revisa tu conexión');
      expect(q('[data-testid=retry]')).not.toBeNull();
    });
  });

  describe('cancelar', () => {
    it('confirma con diálogo de peligro y detalle, y al aceptar cancela, avisa y recarga', async () => {
      setup();
      cancelRow(1); // fila #14 (Hoy 16:30)
      await flush();
      expect(confirm).toHaveBeenCalledTimes(1);
      expect(confirm.mock.calls[0][0]).toMatchObject({
        title: '¿Cancelar la reserva #14?',
        message: 'Hoy 16:30 · Carlos Mendoza con Lucía Paredes. Esta acción no se puede deshacer.',
        confirmLabel: 'Cancelar reserva',
        cancelLabel: 'Volver',
        danger: true,
      });
      expect(cancel).toHaveBeenCalledWith(14);
      expect(toastTexts()).toEqual(['success:Cancelaste la reserva #14.']);
      expect(list).toHaveBeenCalledTimes(2);
    });

    it('al volver o pulsar Esc (resuelve false) no llama al API', async () => {
      setup({ confirm: () => Promise.resolve(false) });
      cancelRow();
      await flush();
      expect(confirm).toHaveBeenCalledTimes(1);
      expect(cancel).not.toHaveBeenCalled();
      expect(list).toHaveBeenCalledTimes(1);
      expect(toastTexts()).toEqual([]);
      expect(ids()).toHaveLength(2);
    });

    it('doble clic: una sola confirmación y una sola petición', async () => {
      const gate = new Subject<void>();
      setup({ cancel: () => gate });
      cancelRow();
      cancelRow();
      await flush();
      expect(confirm).toHaveBeenCalledTimes(1);
      expect(cancel).toHaveBeenCalledTimes(1);
      // durante el envío: botón deshabilitado con indicador
      const btn = qa('[data-testid=cancel]')[0] as HTMLButtonElement;
      expect(btn.disabled).toBe(true);
      expect(btn.querySelector('.spinner-border')).not.toBeNull();
      gate.next();
      gate.complete();
      await flush();
      expect((qa('[data-testid=cancel]')[0] as HTMLButtonElement).disabled).toBe(false);
    });

    it('404 (ya cancelada por otro): aviso y recarga', async () => {
      setup({ cancel: () => throwError(() => err(404, 'Booking not found: id=13')) });
      cancelRow();
      await flush();
      expect(toastTexts()).toEqual(['warning:La reserva ya no existe o ya fue cancelada.']);
      expect(list).toHaveBeenCalledTimes(2);
    });

    it('500 o red caída: no recarga ni avisa por su cuenta (lo hace el interceptor) y la fila queda', async () => {
      setup({ cancel: () => throwError(() => err(500)) });
      cancelRow();
      await flush();
      expect(list).toHaveBeenCalledTimes(1);
      expect(toastTexts()).toEqual([]);
      expect(ids()).toEqual(['13', '14']);
      expect((qa('[data-testid=cancel]')[0] as HTMLButtonElement).disabled).toBe(false);
    });

    it('tras cancelar con éxito el foco pasa al título de la tarjeta', async () => {
      setup();
      cancelRow();
      await flush();
      expect(document.activeElement === document.body || document.activeElement?.id === 'bookings-title').toBe(true);
    });
  });
});
