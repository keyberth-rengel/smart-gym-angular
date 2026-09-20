import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Observable, Subject, of, throwError } from 'rxjs';
import { BookingsApi } from '../../../core/api/bookings.api';
import { CustomersApi } from '../../../core/api/customers.api';
import { HealthApi } from '../../../core/api/health.api';
import { TrainersApi } from '../../../core/api/trainers.api';
import { ApiError } from '../../../core/http/api-error';
import { Booking, Customer, Health, Trainer } from '../../../core/models';
import { AdminDashboard } from './dashboard';

const err = (status: number) => new ApiError(status, `HTTP_${status}`, 'x', {}, 'x');
const booking = (id: number, date: string, time: string, c: string, t: string): Booking => ({
  id,
  customer_email: c,
  trainer_email: t,
  date,
  time,
  note: null,
});

const BOOKINGS = [
  booking(2, '2026-09-19', '18:00', 'carlos@x.com', 'lucia@x.com'),
  booking(1, '2026-09-19', '16:30', 'rosa@x.com', 'marco@x.com'),
  booking(3, '2026-09-18', '10:00', 'carlos@x.com', 'lucia@x.com'),
];
const CUSTOMERS: Customer[] = [
  { email: 'carlos@x.com', name: 'Carlos Mendoza', age: 28 },
  { email: 'rosa@x.com', name: 'Rosa Lima', age: 34 },
];
const TRAINERS: Trainer[] = [
  { email: 'lucia@x.com', name: 'Lucía Paredes', age: 33, specialty: 'Fuerza' },
  { email: 'marco@x.com', name: 'Marco Vílchez', age: 29, specialty: 'Funcional' },
];
const UP: Health = { status: 'UP', uptimeSeconds: 10, startedAt: 't' };

describe('AdminDashboard', () => {
  let fixture: ComponentFixture<AdminDashboard>;
  let el: HTMLElement;
  let check: ReturnType<typeof vi.fn<() => Observable<Health>>>;
  let bookings: ReturnType<typeof vi.fn<() => Observable<Booking[]>>>;
  let customers: ReturnType<typeof vi.fn<() => Observable<Customer[]>>>;
  let trainers: ReturnType<typeof vi.fn<() => Observable<Trainer[]>>>;

  function setup(
    opts: {
      health?: () => Observable<Health>;
      bookings?: () => Observable<Booking[]>;
      customers?: () => Observable<Customer[]>;
      trainers?: () => Observable<Trainer[]>;
    } = {},
  ) {
    check = vi.fn(opts.health ?? (() => of(UP)));
    bookings = vi.fn(opts.bookings ?? (() => of(BOOKINGS)));
    customers = vi.fn(opts.customers ?? (() => of(CUSTOMERS)));
    trainers = vi.fn(opts.trainers ?? (() => of(TRAINERS)));
    TestBed.configureTestingModule({
      imports: [AdminDashboard],
      providers: [
        provideRouter([]),
        { provide: HealthApi, useValue: { check } },
        { provide: BookingsApi, useValue: { list: bookings } },
        { provide: CustomersApi, useValue: { list: customers } },
        { provide: TrainersApi, useValue: { list: trainers } },
      ],
    });
    fixture = TestBed.createComponent(AdminDashboard);
    el = fixture.nativeElement;
    fixture.detectChanges();
  }

  const q = <T extends HTMLElement>(s: string) => el.querySelector(s) as T;
  const qa = (s: string) => Array.from(el.querySelectorAll<HTMLElement>(s));
  const health = () => q('[data-testid=health]').textContent!.replace(/\s+/g, ' ').trim();
  const todayRows = () =>
    qa('[data-testid=today-row]').map((r) =>
      Array.from(r.querySelectorAll('td')).map((td) => td.textContent!.trim()),
    );

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 8, 19, 15, 10)); // sábado
  });
  afterEach(() => vi.useRealTimers());

  it('título, fecha larga y las 5 tarjetas de módulo con sus enlaces', () => {
    setup();
    expect(q('h1').textContent).toContain('Panel de administración');
    expect(el.textContent).toContain('Sábado, 19 de septiembre de 2026');
    const cards = qa('[data-testid=module]');
    expect(cards.map((c) => c.querySelector('.module-title')!.textContent)).toEqual([
      'Clientes',
      'Entrenadores',
      'Reservas',
      'Rutinas',
      'Asistencia',
    ]);
    expect(cards.map((c) => c.getAttribute('href'))).toEqual([
      '/admin/clientes',
      '/admin/entrenadores',
      '/admin/reservas',
      '/admin/rutinas',
      '/admin/asistencia',
    ]);
  });

  describe('estado del servicio', () => {
    it('en línea', () => {
      setup();
      expect(health()).toContain('Servicio en línea');
      expect(q('[data-testid=health]').classList).toContain('up');
    });

    it('caído (error de red o 500): sin conexión, sin romper el resto', () => {
      setup({ health: () => throwError(() => err(500)) });
      expect(health()).toContain('Sin conexión');
      expect(q('[data-testid=health]').classList).toContain('down');
      expect(qa('[data-testid=today-row]')).toHaveLength(2);
    });

    it('una respuesta que no dice UP también cuenta como caído', () => {
      setup({ health: () => of({ ...UP, status: 'DOWN' }) });
      expect(health()).toContain('Sin conexión');
    });

    it('comprobando: deshabilitado; al hacer clic vuelve a consultar', () => {
      const pending = new Subject<Health>();
      setup({ health: () => pending });
      expect(health()).toContain('Comprobando');
      expect(q<HTMLButtonElement>('[data-testid=health]').disabled).toBe(true);
      pending.next(UP);
      pending.complete();
      fixture.detectChanges();
      check.mockReturnValue(throwError(() => err(0)));
      q<HTMLButtonElement>('[data-testid=health]').click();
      fixture.detectChanges();
      expect(check).toHaveBeenCalledTimes(2);
      expect(health()).toContain('Sin conexión');
    });
  });

  describe('reservas de hoy', () => {
    it('solo las de hoy, por hora, con nombres de cliente y entrenador', () => {
      setup();
      expect(todayRows()).toEqual([
        ['16:30', 'Rosa Lima', 'Marco Vílchez'],
        ['18:00', 'Carlos Mendoza', 'Lucía Paredes'],
      ]);
      expect(q('[data-testid=all-bookings]').getAttribute('href')).toBe('/admin/reservas');
    });

    it('si no se pueden cargar los nombres muestra los correos', () => {
      setup({
        customers: () => throwError(() => err(500)),
        trainers: () => throwError(() => err(500)),
      });
      expect(todayRows()).toEqual([
        ['16:30', 'rosa@x.com', 'marco@x.com'],
        ['18:00', 'carlos@x.com', 'lucia@x.com'],
      ]);
      expect(q('[data-testid=bookings-retry]')).toBeNull();
    });

    it('sin reservas hoy: mensaje', () => {
      setup({ bookings: () => of([BOOKINGS[2]]) });
      expect(q('[data-testid=today-empty]').textContent).toContain('No hay reservas para hoy');
      expect(q('[data-testid=today-table]')).toBeNull();
    });

    it('cargando: esqueleto', () => {
      setup({ bookings: () => new Subject<Booking[]>() });
      expect(q('[data-testid=loading-table]')).not.toBeNull();
    });

    it('error aislado: aviso con Reintentar; el estado del servicio y los módulos siguen', () => {
      setup({ bookings: () => throwError(() => err(500)) });
      expect(q('[data-testid=bookings-retry]')).not.toBeNull();
      expect(health()).toContain('Servicio en línea');
      expect(qa('[data-testid=module]')).toHaveLength(5);
      bookings.mockReturnValue(of(BOOKINGS));
      q<HTMLButtonElement>('[data-testid=bookings-retry]').click();
      fixture.detectChanges();
      expect(bookings).toHaveBeenCalledTimes(2);
      expect(qa('[data-testid=today-row]')).toHaveLength(2);
    });

    it('a medianoche "hoy" cambia de día al recargar', () => {
      setup();
      vi.setSystemTime(new Date(2026, 8, 20, 0, 0));
      bookings.mockReturnValue(of(BOOKINGS));
      (fixture.componentInstance as unknown as { loadBookings(): void }).loadBookings();
      fixture.detectChanges();
      expect(q('[data-testid=today-empty]')).not.toBeNull();
    });
  });
});
