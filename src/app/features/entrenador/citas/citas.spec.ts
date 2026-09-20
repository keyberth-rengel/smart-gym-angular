import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Observable, Subject, of, throwError } from 'rxjs';
import { MeApi } from '../../../core/api/me.api';
import { TrainersApi } from '../../../core/api/trainers.api';
import { AuthService } from '../../../core/auth/auth.service';
import { ApiError } from '../../../core/http/api-error';
import { Booking, BookingQuery, TrainerCustomer } from '../../../core/models';
import { createFakeClerk, fakeUser, provideFakeClerk } from '../../../testing/fake-clerk';
import { testMe } from '../../../testing/test-me';
import { EntrenadorCitas } from './citas';

const err = (status: number) => new ApiError(status, `HTTP_${status}`, '', {}, '');
const booking = (
  id: number,
  date: string,
  time: string,
  email: string,
  note: string | null = null,
): Booking => ({
  id,
  customer_email: email,
  trainer_email: 'lucia@smartgym.pe',
  date,
  time,
  note,
});
const CUSTOMERS = [
  { email: 'carlos@correo.com', name: 'Carlos Mendoza' },
  { email: 'diego@correo.com', name: 'Diego Quispe' },
] as TrainerCustomer[];

// Semana del lunes 14 al domingo 20 de septiembre de 2026.
const WEEK = [
  booking(1, '2026-09-19', '18:00', 'diego@correo.com', 'Fuerza'),
  booking(2, '2026-09-19', '16:30', 'carlos@correo.com', 'Piernas'),
  booking(3, '2026-09-16', '07:00', 'carlos@correo.com'),
  booking(4, '2026-09-20', '09:00', 'diego@correo.com', 'Domingo'),
];

describe('EntrenadorCitas', () => {
  let fixture: ComponentFixture<EntrenadorCitas>;
  let el: HTMLElement;
  let bookings: ReturnType<typeof vi.fn<(email: string, q: BookingQuery) => Observable<Booking[]>>>;

  function setup(
    week: (q: BookingQuery) => Observable<Booking[]> = () => of(WEEK),
    customers: () => Observable<TrainerCustomer[]> = () => of(CUSTOMERS),
  ) {
    bookings = vi.fn((_e: string, q: BookingQuery) => week(q));
    TestBed.configureTestingModule({
      imports: [EntrenadorCitas],
      providers: [
        provideFakeClerk(
          createFakeClerk({
            user: fakeUser({ email: 'lucia@smartgym.pe', name: 'Lucía Paredes' }),
          }),
        ),
        { provide: MeApi, useValue: {} },
        { provide: TrainersApi, useValue: { bookings, customers } },
      ],
    });
    TestBed.inject(AuthService).applyMe(
      testMe({ role: 'entrenador', email: 'lucia@smartgym.pe', name: 'Lucía Paredes' }),
    );
    fixture = TestBed.createComponent(EntrenadorCitas);
    el = fixture.nativeElement;
    fixture.detectChanges();
  }

  const q = <T extends HTMLElement>(s: string) => el.querySelector(s) as T;
  const qa = (s: string) => Array.from(el.querySelectorAll<HTMLElement>(s));
  const txt = (s: string) => q(s).textContent!.replace(/\s+/g, ' ').trim();
  const days = () => qa('[data-testid=day]');
  const slots = () =>
    qa('[data-testid=slot]').map((s) => ({
      time: s.querySelector('.slot-time')!.textContent!.trim(),
      name: s.querySelector('.slot-name')!.textContent!.trim(),
      note: s.querySelector('.slot-note')!.textContent!.trim(),
      next: s.textContent!.includes('Próxima'),
    }));
  const click = (b: HTMLElement) => {
    b.click();
    fixture.detectChanges();
  };

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 8, 19, 15, 10)); // sábado
  });
  afterEach(() => vi.useRealTimers());

  it('pide la semana actual (lunes a domingo) con una sola llamada', () => {
    setup();
    expect(bookings).toHaveBeenCalledTimes(1);
    expect(bookings).toHaveBeenCalledWith('lucia@smartgym.pe', {
      from: '2026-09-14',
      to: '2026-09-20',
    });
    expect(txt('[data-testid=week-range]')).toBe('14 – 20 sep');
  });

  it('la tira muestra los 7 días con hoy marcado y seleccionado', () => {
    setup();
    expect(days().map((d) => d.querySelector('.day-short')!.textContent!.trim())).toEqual([
      'Lun',
      'Mar',
      'Mié',
      'Jue',
      'Vie',
      'Sáb',
      'Dom',
    ]);
    expect(days().map((d) => d.querySelector('.day-num')!.textContent!.trim())).toEqual([
      '14',
      '15',
      '16',
      '17',
      '18',
      '19',
      '20',
    ]);
    const sat = days()[5];
    expect(sat.textContent).toContain('HOY');
    expect(sat.getAttribute('aria-pressed')).toBe('true');
    expect(days().filter((d) => d.textContent!.includes('HOY'))).toHaveLength(1);
    expect(days().filter((d) => d.getAttribute('aria-pressed') === 'true')).toHaveLength(1);
  });

  it('cada día anuncia su cantidad de citas y marca los que tienen', () => {
    setup();
    expect(days()[5].getAttribute('aria-label')).toBe('Sáb 19, 2 citas');
    expect(days()[2].getAttribute('aria-label')).toBe('Mié 16, 1 cita');
    expect(days()[0].getAttribute('aria-label')).toBe('Lun 14, 0 citas');
    expect(days().map((d) => d.querySelector('.day-dot')!.classList.contains('on'))).toEqual([
      false,
      false,
      true,
      false,
      false,
      true,
      true,
    ]);
  });

  it('el día de hoy lista las citas ordenadas con nombre, nota y "Próxima" solo en la siguiente', () => {
    setup();
    expect(txt('[data-testid=day-title]')).toBe('Sábado 19 sep');
    expect(txt('[data-testid=day-count]')).toBe('2 citas');
    expect(slots()).toEqual([
      { time: '16:30', name: 'Carlos Mendoza', note: 'Nota: Piernas', next: true },
      { time: '18:00', name: 'Diego Quispe', note: 'Nota: Fuerza', next: false },
    ]);
  });

  it('elegir otro día cambia la lista sin volver a pedir nada; en un día futuro no hay "Próxima"', () => {
    setup();
    click(days()[6]); // domingo 20
    expect(bookings).toHaveBeenCalledTimes(1);
    expect(txt('[data-testid=day-title]')).toBe('Domingo 20 sep');
    expect(txt('[data-testid=day-count]')).toBe('1 cita');
    expect(slots()).toEqual([
      { time: '09:00', name: 'Diego Quispe', note: 'Nota: Domingo', next: false },
    ]);
    click(days()[2]); // miércoles 16 (pasado)
    expect(slots()).toEqual([
      { time: '07:00', name: 'Carlos Mendoza', note: 'Nota: —', next: false },
    ]);
  });

  it('un día sin citas muestra el estado vacío', () => {
    setup();
    click(days()[0]);
    expect(txt('[data-testid=day-count]')).toBe('Sin citas');
    expect(q('[data-testid=slots]')).toBeNull();
    expect(q('[data-testid=empty-state]').textContent).toContain('Sin citas este día');
  });

  it('semana siguiente: nuevo rango, abre en el lunes y aparece "Hoy"', () => {
    setup(() => of([]));
    expect(q('[data-testid=week-today]')).toBeNull();
    click(q('[data-testid=week-next]'));
    expect(bookings).toHaveBeenLastCalledWith('lucia@smartgym.pe', {
      from: '2026-09-21',
      to: '2026-09-27',
    });
    expect(txt('[data-testid=week-range]')).toBe('21 – 27 sep');
    expect(txt('[data-testid=day-title]')).toBe('Lunes 21 sep');
    expect(days()[0].getAttribute('aria-pressed')).toBe('true');
    expect(days().some((d) => d.textContent!.includes('HOY'))).toBe(false);
    expect(q('[data-testid=week-today]')).not.toBeNull();
  });

  it('semana anterior y botón "Hoy" vuelven a la semana actual con hoy seleccionado', () => {
    setup(() => of([]));
    click(q('[data-testid=week-prev]'));
    expect(bookings).toHaveBeenLastCalledWith('lucia@smartgym.pe', {
      from: '2026-09-07',
      to: '2026-09-13',
    });
    expect(txt('[data-testid=week-range]')).toBe('07 – 13 sep');
    click(q('[data-testid=week-today]'));
    expect(bookings).toHaveBeenLastCalledWith('lucia@smartgym.pe', {
      from: '2026-09-14',
      to: '2026-09-20',
    });
    expect(txt('[data-testid=day-title]')).toBe('Sábado 19 sep');
    expect(q('[data-testid=week-today]')).toBeNull();
  });

  it('una semana que cruza de mes se rotula con ambos meses', () => {
    setup(() => of([]));
    click(q('[data-testid=week-next]'));
    click(q('[data-testid=week-next]'));
    expect(txt('[data-testid=week-range]')).toBe('28 sep – 04 oct');
  });

  it('una respuesta tardía de una semana anterior no pisa a la actual', () => {
    const first = new Subject<Booking[]>();
    const second = new Subject<Booking[]>();
    let n = 0;
    setup(() => (n++ === 0 ? first : second));
    click(q('[data-testid=week-next]'));
    second.next([booking(9, '2026-09-22', '10:00', 'carlos@correo.com')]);
    second.complete();
    fixture.detectChanges();
    first.next(WEEK);
    first.complete();
    fixture.detectChanges();
    click(days()[1]); // martes 22
    expect(slots().map((s) => s.time)).toEqual(['10:00']);
    expect(txt('[data-testid=week-range]')).toBe('21 – 27 sep');
  });

  it('si los clientes no cargan, los nombres se reemplazan por el correo', () => {
    setup(
      () => of(WEEK),
      () => throwError(() => err(500)),
    );
    expect(slots().map((s) => s.name)).toEqual(['carlos@correo.com', 'diego@correo.com']);
  });

  it('esqueleto mientras carga', () => {
    setup(() => new Subject<Booking[]>());
    expect(q('[data-testid=loading-table]')).not.toBeNull();
    expect(q('[data-testid=slots]')).toBeNull();
  });

  it('error: mensaje con "Reintentar" que vuelve a pedir la misma semana y se recupera', () => {
    let fail = true;
    setup(() => (fail ? throwError(() => err(500)) : of(WEEK)));
    expect(q('[data-testid=retry]')).not.toBeNull();
    expect(q('[data-testid=slots]')).toBeNull();
    fail = false;
    click(q('[data-testid=retry]'));
    expect(bookings).toHaveBeenCalledTimes(2);
    expect(bookings).toHaveBeenLastCalledWith('lucia@smartgym.pe', {
      from: '2026-09-14',
      to: '2026-09-20',
    });
    expect(slots()).toHaveLength(2);
  });

  it('un 403 (correo ajeno) también cae en el estado de error', () => {
    setup(() => throwError(() => err(403)));
    expect(q('[data-testid=retry]')).not.toBeNull();
  });

  it('a medianoche el domingo se considera hoy y la semana sigue siendo la misma', () => {
    vi.setSystemTime(new Date(2026, 8, 20, 0, 5));
    setup();
    expect(bookings).toHaveBeenCalledWith('lucia@smartgym.pe', {
      from: '2026-09-14',
      to: '2026-09-20',
    });
    expect(txt('[data-testid=day-title]')).toBe('Domingo 20 sep');
    expect(days()[6].textContent).toContain('HOY');
    // la cita del domingo 09:00 es la próxima de hoy
    expect(slots()[0].next).toBe(true);
  });
});
