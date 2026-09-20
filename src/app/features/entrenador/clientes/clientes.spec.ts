import { HttpContext } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { Observable, Subject, of, throwError } from 'rxjs';
import { MeApi } from '../../../core/api/me.api';
import { ProgressApi } from '../../../core/api/progress.api';
import { RoutinesApi } from '../../../core/api/routines.api';
import { TrainersApi } from '../../../core/api/trainers.api';
import { AuthService } from '../../../core/auth/auth.service';
import { ApiError } from '../../../core/http/api-error';
import { SKIP_ERROR_TOAST } from '../../../core/http/error.interceptor';
import { ProgressList, RoutineHistoryItem, TrainerCustomer } from '../../../core/models';
import { createFakeClerk, fakeUser, provideFakeClerk } from '../../../testing/fake-clerk';
import { testMe } from '../../../testing/test-me';
import { EntrenadorClientes } from './clientes';

const err = (status: number, raw = '') => new ApiError(status, `HTTP_${status}`, raw, {}, raw);

const customer = (
  email: string,
  name: string,
  over: Partial<TrainerCustomer> = {},
): TrainerCustomer => ({
  email,
  name,
  age: 30,
  sessions: 1,
  last_booking_date: '2026-09-12',
  last_booking_time: '17:00',
  ...over,
});
const CUSTOMERS = [
  customer('carlos@correo.com', 'Carlos Mendoza', {
    age: 28,
    sessions: 6,
    last_booking_date: '2026-09-19',
    last_booking_time: '16:30',
  }),
  customer('maria@correo.com', 'María Pérez', {
    sessions: 3,
    last_booking_date: '2026-09-25',
    last_booking_time: '09:00',
  }),
  customer('diego@correo.com', 'Diego Quispe', { sessions: 2 }),
];
const PROGRESS: ProgressList = {
  items: [
    { date: '2026-09-15', weight_kg: 74.5, body_fat_pct: 18.2, muscle_pct: 42.1 },
    { date: '2026-08-31', weight_kg: 75.6, body_fat_pct: 19.3, muscle_pct: 41.4 },
  ],
  total: 2,
  avg_weight_kg: 75,
  avg_body_fat_pct: 18.7,
  avg_muscle_pct: 41.7,
};
const HISTORY: RoutineHistoryItem[] = [
  { created_at: '2026-07-14T10:00:00', plan: { monday: 'Cardio', saturday: 'Legs' } },
  {
    created_at: '2026-09-08T09:15:00',
    plan: {
      monday: 'Legs',
      tuesday: 'Chest',
      wednesday: 'Back',
      thursday: 'Shoulders',
      friday: 'Arms',
      saturday: 'Cardio',
    },
  },
];

describe('EntrenadorClientes', () => {
  let fixture: ComponentFixture<EntrenadorClientes>;
  let el: HTMLElement;
  let customers: ReturnType<typeof vi.fn<(email: string) => Observable<TrainerCustomer[]>>>;
  let progress: ReturnType<
    typeof vi.fn<(email: string, ctx?: HttpContext) => Observable<ProgressList>>
  >;
  let history: ReturnType<
    typeof vi.fn<(email: string, ctx?: HttpContext) => Observable<RoutineHistoryItem[]>>
  >;
  let router: Router;

  function setup(
    o: {
      customers?: () => Observable<TrainerCustomer[]>;
      progress?: (email: string) => Observable<ProgressList>;
      history?: (email: string) => Observable<RoutineHistoryItem[]>;
    } = {},
  ) {
    customers = vi.fn(o.customers ?? (() => of(CUSTOMERS)));
    progress = vi.fn(o.progress ?? (() => of(PROGRESS)));
    history = vi.fn(o.history ?? (() => of(HISTORY)));
    TestBed.configureTestingModule({
      imports: [EntrenadorClientes],
      providers: [
        provideRouter([]),
        provideFakeClerk(
          createFakeClerk({
            user: fakeUser({ email: 'lucia@smartgym.pe', name: 'Lucía Paredes' }),
          }),
        ),
        { provide: MeApi, useValue: {} },
        { provide: TrainersApi, useValue: { customers } },
        { provide: ProgressApi, useValue: { listByEmail: progress } },
        { provide: RoutinesApi, useValue: { historyByEmail: history } },
      ],
    });
    TestBed.inject(AuthService).applyMe(
      testMe({ role: 'entrenador', email: 'lucia@smartgym.pe', name: 'Lucía Paredes' }),
    );
    router = TestBed.inject(Router);
    fixture = TestBed.createComponent(EntrenadorClientes);
    el = fixture.nativeElement;
    fixture.detectChanges();
  }

  const q = <T extends HTMLElement>(s: string) => el.querySelector(s) as T;
  const qa = (s: string) => Array.from(el.querySelectorAll<HTMLElement>(s));
  const txt = (s: string) => q(s).textContent!.replace(/\s+/g, ' ').trim();
  const rows = () => qa('[data-testid=client-row]');
  const cells = (r: HTMLElement) =>
    Array.from(r.querySelectorAll('td')).map((td) => td.textContent!.replace(/\s+/g, ' ').trim());
  const search = (v: string) => {
    const input = q<HTMLInputElement>('[data-testid=search]');
    input.value = v;
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  };
  const cellsOfBlock = (s: string) =>
    qa(`${s} [data-testid=plan-cell]`).map(
      (c) =>
        `${c.querySelector('.plan-day')!.textContent!.trim()} ${c.querySelector('.plan-block')!.textContent!.trim()}`,
    );

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 8, 19, 15, 10));
  });
  afterEach(() => vi.useRealTimers());

  it('pide los clientes del entrenador y los lista con sesiones y su última/próxima cita', () => {
    setup();
    expect(customers).toHaveBeenCalledWith('lucia@smartgym.pe');
    expect(txt('[data-testid=total]')).toBe('3');
    expect(rows().map(cells)).toEqual([
      ['Carlos Mendoza', 'carlos@correo.com', '6', 'Hoy 16:30'],
      ['María Pérez', 'maria@correo.com', '3', '25 sep 09:00'],
      ['Diego Quispe', 'diego@correo.com', '2', '12 sep'],
    ]);
  });

  it('selecciona al primero y carga su detalle (progreso y rutina, una petición por bloque)', () => {
    setup();
    expect(rows()[0].classList.contains('selected')).toBe(true);
    expect(progress).toHaveBeenCalledTimes(1);
    expect(progress).toHaveBeenCalledWith('carlos@correo.com', expect.anything());
    expect(history).toHaveBeenCalledTimes(1);
    expect(history).toHaveBeenCalledWith('carlos@correo.com', expect.anything());
    expect(txt('[data-testid=detail-name]')).toBe('Carlos Mendoza');
    expect(txt('[data-testid=detail]')).toContain('28 años · carlos@correo.com');
  });

  it('las peticiones del detalle no muestran toast automático (usan SKIP_ERROR_TOAST)', () => {
    setup();
    expect(progress.mock.calls[0][1]!.get(SKIP_ERROR_TOAST)).toBe(true);
    expect(history.mock.calls[0][1]!.get(SKIP_ERROR_TOAST)).toBe(true);
  });

  it('el último progreso sale del registro más reciente (aunque llegue desordenado)', () => {
    setup({ progress: () => of({ ...PROGRESS, items: [PROGRESS.items[1], PROGRESS.items[0]] }) });
    const t = txt('[data-testid=progress-block]');
    expect(t).toContain('74.5 kg');
    expect(t).toContain('18.2 %');
    expect(t).toContain('42.1 %');
    expect(txt('[data-testid=detail]')).toContain('Registrado el 15 sep 2026');
  });

  it('la rutina activa es la última del historial, con bloques traducidos', () => {
    setup();
    expect(cellsOfBlock('[data-testid=routine-block]')).toEqual([
      'Lun Piernas',
      'Mar Pecho',
      'Mié Espalda',
      'Jue Hombros',
      'Vie Brazos',
      'Sáb Cardio',
    ]);
  });

  it('elegir otro cliente carga su detalle con su correo', () => {
    setup();
    rows()[1].click();
    fixture.detectChanges();
    expect(progress).toHaveBeenLastCalledWith('maria@correo.com', expect.anything());
    expect(history).toHaveBeenLastCalledWith('maria@correo.com', expect.anything());
    expect(txt('[data-testid=detail-name]')).toBe('María Pérez');
    expect(rows()[1].classList.contains('selected')).toBe(true);
    expect(rows()[0].classList.contains('selected')).toBe(false);
  });

  it('con teclado: el botón del nombre (Enter/Espacio) selecciona la fila y marca aria-current', () => {
    setup();
    const btn = rows()[2].querySelector<HTMLButtonElement>('[data-testid=client-select]')!;
    expect(btn.tagName).toBe('BUTTON');
    btn.click(); // Enter y Espacio sobre un botón disparan click
    fixture.detectChanges();
    expect(btn.getAttribute('aria-current')).toBe('true');
    expect(
      rows()[0].querySelector('[data-testid=client-select]')!.getAttribute('aria-current'),
    ).toBeNull();
    expect(txt('[data-testid=detail-name]')).toBe('Diego Quispe');
    expect(history).toHaveBeenCalledTimes(2);
  });

  it('una respuesta tardía del cliente anterior no pisa el detalle del elegido', () => {
    const first = new Subject<ProgressList>();
    const second = new Subject<ProgressList>();
    setup({ progress: (email) => (email === 'carlos@correo.com' ? first : second) });
    rows()[1].click();
    second.next({
      ...PROGRESS,
      items: [{ date: '2026-09-18', weight_kg: 60, body_fat_pct: 25, muscle_pct: 30 }],
    });
    second.complete();
    fixture.detectChanges();
    first.next(PROGRESS);
    first.complete();
    fixture.detectChanges();
    expect(txt('[data-testid=progress-block]')).toContain('60.0 kg');
  });

  describe('búsqueda', () => {
    it('filtra por nombre sin distinguir acentos ni mayúsculas', () => {
      setup();
      search('MARIA');
      expect(rows().map((r) => cells(r)[0])).toEqual(['María Pérez']);
    });

    it('filtra por correo', () => {
      setup();
      search('diego@');
      expect(rows().map((r) => cells(r)[0])).toEqual(['Diego Quispe']);
    });

    it('sin resultados muestra el mensaje y "Limpiar búsqueda" restaura la lista', () => {
      setup();
      search('zzz');
      expect(rows()).toHaveLength(0);
      expect(txt('[data-testid=no-results]')).toContain('Sin resultados para «zzz»');
      q<HTMLButtonElement>('[data-testid=clear-search]').click();
      fixture.detectChanges();
      expect(rows()).toHaveLength(3);
      expect(q<HTMLInputElement>('[data-testid=search]').value).toBe('');
    });

    it('el cliente elegido conserva su detalle aunque el filtro lo oculte', () => {
      setup();
      search('maria');
      expect(txt('[data-testid=detail-name]')).toBe('Carlos Mendoza');
      expect(history).toHaveBeenCalledTimes(1);
    });
  });

  describe('bloques del detalle', () => {
    it('sin progreso ni rutina: textos vacíos', () => {
      setup({ progress: () => of({ ...PROGRESS, items: [], total: 0 }), history: () => of([]) });
      expect(txt('[data-testid=progress-empty]')).toContain('aún no registra progreso');
      expect(txt('[data-testid=routine-empty]')).toContain('aún no tiene rutina');
      expect(q('[data-testid=assign-routine]')).not.toBeNull();
    });

    it('un "no encontrado" (404 o 422) se ve como vacío', () => {
      setup({
        progress: () => throwError(() => err(404)),
        history: () => throwError(() => err(422, 'No active routine not found')),
      });
      expect(q('[data-testid=progress-empty]')).not.toBeNull();
      expect(q('[data-testid=routine-empty]')).not.toBeNull();
    });

    it('403: "Sin acceso a este cliente" en ambos bloques', () => {
      setup({
        progress: () => throwError(() => err(403)),
        history: () => throwError(() => err(403)),
      });
      expect(txt('[data-testid=progress-forbidden]')).toContain('Sin acceso a este cliente');
      expect(txt('[data-testid=routine-forbidden]')).toContain('Sin acceso a este cliente');
    });

    it('cada bloque falla por separado y su "Reintentar" solo repite ese bloque', () => {
      let failProgress = true;
      setup({ progress: () => (failProgress ? throwError(() => err(500)) : of(PROGRESS)) });
      expect(q('[data-testid=progress-error]')).not.toBeNull();
      expect(q('[data-testid=routine-block]')).not.toBeNull();
      failProgress = false;
      q<HTMLButtonElement>('[data-testid=progress-retry]').click();
      fixture.detectChanges();
      expect(progress).toHaveBeenCalledTimes(2);
      expect(history).toHaveBeenCalledTimes(1);
      expect(q('[data-testid=progress-block]')).not.toBeNull();
    });

    it('esqueletos mientras carga el detalle', () => {
      setup({
        progress: () => new Subject<ProgressList>(),
        history: () => new Subject<RoutineHistoryItem[]>(),
      });
      expect(qa('[data-testid=loading-card]')).toHaveLength(2);
    });
  });

  it('"Asignar nueva rutina" lleva a Rutinas con el cliente elegido en la URL', () => {
    setup();
    const nav = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    rows()[1].click();
    fixture.detectChanges();
    q<HTMLButtonElement>('[data-testid=assign-routine]').click();
    expect(nav).toHaveBeenCalledWith(['/entrenador/rutinas'], {
      queryParams: { cliente: 'maria@correo.com' },
    });
  });

  describe('lista', () => {
    it('sin clientes: estado vacío y sin detalle', () => {
      setup({ customers: () => of([]) });
      expect(q('[data-testid=empty-state]').textContent).toContain('Aún no tienes clientes');
      expect(q('[data-testid=detail]')).toBeNull();
      expect(progress).not.toHaveBeenCalled();
    });

    it('esqueleto mientras carga', () => {
      setup({ customers: () => new Subject<TrainerCustomer[]>() });
      expect(q('[data-testid=loading-table]')).not.toBeNull();
    });

    it('error (500, red o 403): mensaje con "Reintentar" que se recupera', () => {
      let fail = true;
      setup({ customers: () => (fail ? throwError(() => err(500)) : of(CUSTOMERS)) });
      expect(q('[data-testid=retry]')).not.toBeNull();
      fail = false;
      q<HTMLButtonElement>('[data-testid=retry]').click();
      fixture.detectChanges();
      expect(customers).toHaveBeenCalledTimes(2);
      expect(rows()).toHaveLength(3);
      expect(q('[data-testid=detail]')).not.toBeNull();
    });
  });
});
