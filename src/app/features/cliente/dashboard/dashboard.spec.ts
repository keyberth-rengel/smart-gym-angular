import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Observable, Subject, of, throwError } from 'rxjs';
import { AttendanceApi } from '../../../core/api/attendance.api';
import { BookingsApi } from '../../../core/api/bookings.api';
import { MeApi } from '../../../core/api/me.api';
import { ProgressApi } from '../../../core/api/progress.api';
import { RoutinesApi } from '../../../core/api/routines.api';
import { TrainersApi } from '../../../core/api/trainers.api';
import { AuthService } from '../../../core/auth/auth.service';
import { ApiError } from '../../../core/http/api-error';
import { createFakeClerk, fakeUser, provideFakeClerk } from '../../../testing/fake-clerk';
import { testMe } from '../../../testing/test-me';
import { ClienteDashboard } from './dashboard';
import { serverTimestamp } from '../../../testing/server-timestamp';

const err = (status: number, raw = '') => new ApiError(status, `HTTP_${status}`, raw, {}, raw);

const DATA = {
  history: () =>
    of([{ created_at: '2026-09-08T10:00:00', plan: { saturday: 'Cardio', monday: 'Legs' } }]),
  bookings: () =>
    of([
      {
        id: 1,
        customer_email: 'a@b.c',
        trainer_email: 'marco@smartgym.pe',
        date: '2026-09-19',
        time: '18:30',
        note: null,
      },
    ]),
  trainers: () =>
    of([{ email: 'marco@smartgym.pe', name: 'Marco Vílchez', age: 29, specialty: null }]),
  progress: () =>
    of({
      items: [{ date: '2026-09-15', weight_kg: 74.5, body_fat_pct: 18.2, muscle_pct: 42.1 }],
      total: 1,
      avg_weight_kg: 74.5,
      avg_body_fat_pct: 18.2,
      avg_muscle_pct: 42.1,
    }),
  attendance: () =>
    of([
      {
        id: 1,
        email: 'a@b.c',
        role: 'CUSTOMER',
        timestamp: serverTimestamp('2026-09-19T06:45:00'),
      },
    ]),
};
type Src = Partial<Record<keyof typeof DATA, () => Observable<unknown>>>;

describe('ClienteDashboard', () => {
  let fixture: ComponentFixture<ClienteDashboard>;
  let el: HTMLElement;
  const calls = { history: vi.fn(), bookings: vi.fn(), progress: vi.fn(), attendance: vi.fn() };

  function setup(over: Src = {}, dni: string | null = '12345678') {
    const s = { ...DATA, ...over } as Record<keyof typeof DATA, () => Observable<never>>;
    Object.values(calls).forEach((c) => c.mockReset());
    TestBed.configureTestingModule({
      imports: [ClienteDashboard],
      providers: [
        provideRouter([]),
        provideFakeClerk(
          createFakeClerk({ user: fakeUser({ email: 'ana@correo.com', name: 'Ana Pérez' }) }),
        ),
        { provide: MeApi, useValue: {} },
        {
          provide: RoutinesApi,
          useValue: { history: (d: string) => (calls.history(d), s.history()) },
        },
        { provide: BookingsApi, useValue: { list: () => (calls.bookings(), s.bookings()) } },
        { provide: TrainersApi, useValue: { list: () => s.trainers() } },
        {
          provide: ProgressApi,
          useValue: { list: (d: string) => (calls.progress(d), s.progress()) },
        },
        {
          provide: AttendanceApi,
          useValue: { list: (d: string) => (calls.attendance(d), s.attendance()) },
        },
      ],
    });
    TestBed.inject(AuthService).applyMe(testMe({ dni }));
    fixture = TestBed.createComponent(ClienteDashboard);
    el = fixture.nativeElement;
    fixture.detectChanges();
  }

  const card = (k: string) => el.querySelector(`[data-testid=card-${k}]`) as HTMLElement;
  const cardText = (k: string) => card(k).textContent!.replace(/\s+/g, ' ').trim();

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 8, 19, 15, 10)); // sábado
  });
  afterEach(() => vi.useRealTimers());

  it('saluda por el nombre y muestra la fecha larga', () => {
    setup();
    expect(el.querySelector('h1')!.textContent).toContain('Bienvenido, Ana');
    expect(el.textContent).toContain('Sábado, 19 de septiembre de 2026');
  });

  it('cuatro tarjetas con sus datos y enlaces a cada pantalla', () => {
    setup();
    expect(cardText('routine')).toContain('Cardio');
    expect(cardText('routine')).toContain('Plan de hoy · activa desde el 08 sep');
    expect(cardText('booking')).toContain('Hoy · 18:30');
    expect(cardText('booking')).toContain('con Marco Vílchez');
    expect(cardText('progress')).toContain('74.5 kg');
    expect(cardText('progress')).toContain('18.2 % grasa · 42.1 % músculo');
    expect(cardText('attendance')).toContain('Hoy · 06:45');
    const links = ['routine', 'booking', 'progress', 'attendance'].map((k) =>
      card(k).querySelector('a')!.getAttribute('href'),
    );
    expect(links).toEqual([
      '/cliente/rutina',
      '/cliente/reservas',
      '/cliente/progreso',
      '/cliente/asistencia',
    ]);
    expect(el.querySelector('[data-testid=banner-attendance]')!.getAttribute('href')).toBe(
      '/cliente/asistencia',
    );
  });

  it('el domingo la rutina es Descanso', () => {
    vi.setSystemTime(new Date(2026, 8, 20, 9, 0));
    setup();
    expect(cardText('routine')).toContain('Descanso');
  });

  it('cuenta nueva: todas las tarjetas en estado vacío (404 y 422 de "no encontrado" equivalen a sin datos)', () => {
    setup({
      history: () => throwError(() => err(404, 'DNI not linked')),
      bookings: () => of([]),
      progress: () => throwError(() => err(422, 'DNI not linked')),
      attendance: () => of([]),
    });
    expect(cardText('routine')).toContain('Sin rutina asignada');
    expect(cardText('booking')).toContain('Sin reservas próximas');
    expect(cardText('progress')).toContain('Sin registros');
    expect(cardText('attendance')).toContain('Sin ingresos');
  });

  it('cada tarjeta muestra su esqueleto mientras carga', () => {
    setup({ history: () => new Subject<never>() });
    expect(card('routine').querySelector('[data-testid=stat-loading]')).not.toBeNull();
    expect(card('booking').querySelector('[data-testid=stat-loading]')).toBeNull();
  });

  it('una tarjeta que falla no afecta a las demás y su Reintentar la recupera', () => {
    let fail = true;
    setup({ progress: () => (fail ? throwError(() => err(500)) : DATA.progress()) });
    expect(cardText('progress')).toContain('No disponible');
    expect(cardText('routine')).toContain('Cardio');
    expect(cardText('booking')).toContain('Hoy · 18:30');
    expect(cardText('attendance')).toContain('Hoy · 06:45');
    fail = false;
    (card('progress').querySelector('[data-testid=stat-retry]') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(cardText('progress')).toContain('74.5 kg');
    expect(calls.progress).toHaveBeenCalledTimes(2);
    expect(calls.history).toHaveBeenCalledTimes(1); // reintentar no recarga las otras
  });

  it('si falla la lista de entrenadores la tarjeta de reserva usa el correo y no falla', () => {
    setup({ trainers: () => throwError(() => err(500)) });
    expect(cardText('booking')).toContain('con marco@smartgym.pe');
  });

  it('sin DNI las tarjetas que lo necesitan quedan en error, pero la de reservas carga', () => {
    setup({}, null);
    expect(cardText('routine')).toContain('No disponible');
    expect(cardText('progress')).toContain('No disponible');
    expect(cardText('attendance')).toContain('No disponible');
    expect(cardText('booking')).toContain('Hoy · 18:30');
    expect(calls.history).not.toHaveBeenCalled();
  });

  it('usa el DNI del usuario en cada consulta', () => {
    setup();
    expect(calls.history).toHaveBeenCalledWith('12345678');
    expect(calls.progress).toHaveBeenCalledWith('12345678');
    expect(calls.attendance).toHaveBeenCalledWith('12345678');
  });
});
