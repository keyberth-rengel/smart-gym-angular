import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Observable, Subject, of, throwError } from 'rxjs';
import { AttendanceApi } from '../../../core/api/attendance.api';
import { MeApi } from '../../../core/api/me.api';
import { TrainersApi } from '../../../core/api/trainers.api';
import { AuthService } from '../../../core/auth/auth.service';
import { ApiError } from '../../../core/http/api-error';
import { Booking, TrainerCustomer } from '../../../core/models';
import { createFakeClerk, fakeUser, provideFakeClerk } from '../../../testing/fake-clerk';
import { testMe } from '../../../testing/test-me';
import { EntrenadorDashboard } from './dashboard';

const err = (status: number, raw = '') => new ApiError(status, `HTTP_${status}`, raw, {}, raw);

const booking = (id: number, time: string, email: string, note: string | null = null): Booking => ({
  id,
  customer_email: email,
  trainer_email: 'lucia@smartgym.pe',
  date: '2026-09-19',
  time,
  note,
});

const BOOKINGS = [
  booking(1, '16:30', 'carlos@correo.com', 'Piernas'),
  booking(2, '18:00', 'diego@correo.com', 'Fuerza'),
];
const CUSTOMERS: TrainerCustomer[] = [
  {
    email: 'carlos@correo.com',
    name: 'Carlos Mendoza',
    age: 28,
    sessions: 6,
    last_booking_date: '2026-09-19',
    last_booking_time: '16:30',
  },
  {
    email: 'diego@correo.com',
    name: 'Diego Quispe',
    age: 22,
    sessions: 3,
    last_booking_date: '2026-09-19',
    last_booking_time: '18:00',
  },
  {
    email: 'miguel@correo.com',
    name: 'Miguel Torres',
    age: 45,
    sessions: 1,
    last_booking_date: '2026-09-18',
    last_booking_time: '18:00',
  },
];

describe('EntrenadorDashboard', () => {
  let fixture: ComponentFixture<EntrenadorDashboard>;
  let el: HTMLElement;
  let bookings: ReturnType<typeof vi.fn<(email: string, q: unknown) => Observable<Booking[]>>>;
  let customers: ReturnType<typeof vi.fn<(email: string) => Observable<TrainerCustomer[]>>>;
  let access: ReturnType<typeof vi.fn<(dni: string) => Observable<string>>>;

  function setup(
    opts: {
      bookings?: () => Observable<Booking[]>;
      customers?: () => Observable<TrainerCustomer[]>;
      access?: () => Observable<string>;
      dni?: string | null;
    } = {},
  ) {
    bookings = vi.fn(opts.bookings ?? (() => of(BOOKINGS)));
    customers = vi.fn(opts.customers ?? (() => of(CUSTOMERS)));
    access = vi.fn(opts.access ?? (() => of('Welcome')));
    TestBed.configureTestingModule({
      imports: [EntrenadorDashboard],
      providers: [
        provideRouter([]),
        provideFakeClerk(
          createFakeClerk({
            user: fakeUser({ email: 'lucia@smartgym.pe', name: 'Lucía Paredes' }),
          }),
        ),
        { provide: MeApi, useValue: {} },
        { provide: TrainersApi, useValue: { bookings, customers } },
        { provide: AttendanceApi, useValue: { access } },
      ],
    });
    TestBed.inject(AuthService).applyMe(
      testMe({
        role: 'entrenador',
        email: 'lucia@smartgym.pe',
        name: 'Lucía Paredes',
        dni: opts.dni === undefined ? '55555555' : opts.dni,
        profile: {
          email: 'lucia@smartgym.pe',
          name: 'Lucía Paredes',
          age: 33,
          specialty: 'Fuerza',
        },
      }),
    );
    fixture = TestBed.createComponent(EntrenadorDashboard);
    el = fixture.nativeElement;
    fixture.detectChanges();
  }

  const q = <T extends HTMLElement>(s: string) => el.querySelector(s) as T;
  const qa = (s: string) => Array.from(el.querySelectorAll<HTMLElement>(s));
  const cardText = (k: string) =>
    q(`[data-testid=card-${k}]`).textContent!.replace(/\s+/g, ' ').trim();
  const flush = async () => {
    await fixture.whenStable();
    fixture.detectChanges();
  };

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 8, 19, 15, 10)); // sábado
  });
  afterEach(() => vi.useRealTimers());

  it('saluda por el nombre, muestra la fecha larga y pide las citas de hoy y los clientes del entrenador', () => {
    setup();
    expect(q('h1').textContent).toContain('Hola, Lucía');
    expect(el.textContent).toContain('Sábado, 19 de septiembre de 2026');
    expect(bookings).toHaveBeenCalledTimes(1);
    expect(bookings).toHaveBeenCalledWith('lucia@smartgym.pe', { date: '2026-09-19' });
    expect(customers).toHaveBeenCalledTimes(1);
    expect(customers).toHaveBeenCalledWith('lucia@smartgym.pe');
  });

  it('tres tarjetas: citas hoy, clientes asociados y próxima cita, con sus enlaces', () => {
    setup();
    expect(cardText('today')).toContain('2');
    expect(cardText('today')).toContain('Próxima a las 16:30');
    expect(cardText('customers')).toContain('3');
    expect(cardText('customers')).toContain('Con al menos una sesión');
    expect(cardText('next')).toContain('16:30');
    expect(cardText('next')).toContain('con Carlos Mendoza');
    const links = ['today', 'customers', 'next'].map((k) =>
      q(`[data-testid=card-${k}] a`).getAttribute('href'),
    );
    expect(links).toEqual(['/entrenador/citas', '/entrenador/clientes', '/entrenador/citas']);
  });

  it('la agenda de hoy lista hora, cliente y nota', () => {
    setup();
    const rows = qa('[data-testid=agenda-row]').map((r) =>
      Array.from(r.querySelectorAll('td')).map((td) => td.textContent!.trim()),
    );
    expect(rows).toEqual([
      ['16:30', 'Carlos Mendoza', 'Piernas'],
      ['18:00', 'Diego Quispe', 'Fuerza'],
    ]);
    expect(q('[data-testid=agenda-link]').getAttribute('href')).toBe('/entrenador/citas');
  });

  it('una cita sin nota muestra un guion', () => {
    setup({ bookings: () => of([booking(1, '16:30', 'carlos@correo.com', null)]) });
    expect(qa('[data-testid=agenda-row] td')[2].textContent!.trim()).toBe('—');
  });

  it('sin citas hoy: tarjetas vacías y mensaje en la agenda', () => {
    setup({ bookings: () => of([]) });
    expect(cardText('today')).toContain('0');
    expect(cardText('today')).toContain('Sin citas hoy');
    expect(cardText('next')).toContain('Sin citas próximas');
    expect(q('[data-testid=agenda-empty]').textContent).toContain('No tienes citas hoy');
    expect(q('[data-testid=agenda-table]')).toBeNull();
  });

  it('si todas las citas de hoy ya pasaron no hay "próxima"', () => {
    vi.setSystemTime(new Date(2026, 8, 19, 20, 0));
    setup();
    expect(cardText('today')).toContain('2');
    expect(cardText('today')).toContain('Sin citas próximas');
    expect(cardText('next')).toContain('Sin citas próximas');
    expect(qa('[data-testid=agenda-row]')).toHaveLength(2);
  });

  it('sin clientes: la tarjeta lo dice', () => {
    setup({ customers: () => of([]) });
    expect(cardText('customers')).toContain('0');
    expect(cardText('customers')).toContain('Aún no tienes clientes');
  });

  it('muestra esqueletos mientras carga', () => {
    setup({
      bookings: () => new Subject<Booking[]>(),
      customers: () => new Subject<TrainerCustomer[]>(),
    });
    expect(qa('[data-testid=stat-loading]')).toHaveLength(3);
    expect(q('[data-testid=loading-table]')).not.toBeNull();
  });

  describe('fallos independientes', () => {
    it('si fallan las citas, las tarjetas de citas y la agenda avisan y la de clientes sigue bien', () => {
      setup({ bookings: () => throwError(() => err(500)) });
      expect(cardText('today')).toContain('No disponible');
      expect(cardText('next')).toContain('No disponible');
      expect(cardText('customers')).toContain('3');
      expect(q('[data-testid=agenda-retry]')).not.toBeNull();
    });

    it('si fallan los clientes, la tarjeta avisa y la agenda usa los correos', () => {
      setup({ customers: () => throwError(() => err(500)) });
      expect(cardText('customers')).toContain('No disponible');
      expect(cardText('today')).toContain('2');
      expect(qa('[data-testid=agenda-row]')[0].textContent).toContain('carlos@correo.com');
      expect(cardText('next')).toContain('con carlos@correo.com');
    });

    it('"Reintentar" de la agenda vuelve a pedir las citas y se recupera', () => {
      let fail = true;
      setup({ bookings: () => (fail ? throwError(() => err(500)) : of(BOOKINGS)) });
      fail = false;
      q<HTMLButtonElement>('[data-testid=agenda-retry]').click();
      fixture.detectChanges();
      expect(bookings).toHaveBeenCalledTimes(2);
      expect(qa('[data-testid=agenda-row]')).toHaveLength(2);
      expect(cardText('today')).toContain('2');
    });

    it('"Reintentar" de la tarjeta de clientes solo repite esa petición', () => {
      let fail = true;
      setup({ customers: () => (fail ? throwError(() => err(500)) : of(CUSTOMERS)) });
      fail = false;
      q<HTMLButtonElement>('[data-testid=card-customers] [data-testid=stat-retry]').click();
      fixture.detectChanges();
      expect(customers).toHaveBeenCalledTimes(2);
      expect(bookings).toHaveBeenCalledTimes(1);
      expect(cardText('customers')).toContain('3');
    });
  });

  describe('marcar asistencia', () => {
    it('con DNI: registra el ingreso una sola vez aunque se pulse dos veces y confirma con nombre y hora', async () => {
      const pending = new Subject<string>();
      setup({ access: () => pending });
      const btn = q<HTMLButtonElement>('[data-testid=mark-attendance]');
      btn.click();
      btn.click();
      fixture.detectChanges();
      expect(access).toHaveBeenCalledTimes(1);
      expect(access).toHaveBeenCalledWith('55555555');
      expect(btn.disabled).toBe(true);
      expect(btn.textContent).toContain('Registrando');

      pending.next('Welcome');
      pending.complete();
      await flush();
      expect(q('[data-testid=att-success]').textContent).toContain(
        '¡Bienvenido Lucía Paredes! Ingreso registrado a las 15:10.',
      );
      expect(btn.disabled).toBe(false);
      expect(q('[data-testid=banner-no-dni]')).toBeNull();
    });

    it('sin DNI vinculado: botón deshabilitado con el aviso y no llama al API', () => {
      setup({ dni: null });
      const btn = q<HTMLButtonElement>('[data-testid=mark-attendance]');
      expect(btn.disabled).toBe(true);
      expect(q('[data-testid=banner-no-dni]').textContent).toContain(
        'Tu DNI no está vinculado; pídelo en recepción.',
      );
      btn.click();
      expect(access).not.toHaveBeenCalled();
    });

    it('DNI no vinculado en el servidor: mensaje en el banner', async () => {
      setup({ access: () => throwError(() => err(404, 'DNI not linked')) });
      q<HTMLButtonElement>('[data-testid=mark-attendance]').click();
      await flush();
      expect(q('[data-testid=att-failure]').textContent).toContain('no está vinculado');
      expect(q('[data-testid=att-success]')).toBeNull();
      expect(q<HTMLButtonElement>('[data-testid=mark-attendance]').disabled).toBe(false);
    });

    it('otro error (500) no deja mensaje en el banner y libera el botón', async () => {
      setup({ access: () => throwError(() => err(500)) });
      q<HTMLButtonElement>('[data-testid=mark-attendance]').click();
      await flush();
      expect(q('[data-testid=att-failure]')).toBeNull();
      expect(q<HTMLButtonElement>('[data-testid=mark-attendance]').disabled).toBe(false);
    });
  });
});
