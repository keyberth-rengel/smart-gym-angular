import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Observable, Subject, of, throwError } from 'rxjs';
import { RoutinesApi } from '../../../core/api/routines.api';
import { MeApi } from '../../../core/api/me.api';
import { ApiError } from '../../../core/http/api-error';
import { RoutineHistoryItem } from '../../../core/models';
import { AuthService } from '../../../core/auth/auth.service';
import { createFakeClerk, fakeUser, provideFakeClerk } from '../../../testing/fake-clerk';
import { testMe } from '../../../testing/test-me';
import { ClienteRutina } from './rutina';

const week = { monday: 'Legs', tuesday: 'Chest', wednesday: 'Back', thursday: 'Shoulders', friday: 'Arms', saturday: 'Cardio' };
const HISTORY: RoutineHistoryItem[] = [
  { created_at: '2026-07-14T10:00:00', plan: { ...week, monday: 'Cardio', saturday: 'Legs' } },
  { created_at: '2026-09-08T09:15:00', plan: week },
];

describe('ClienteRutina', () => {
  let fixture: ComponentFixture<ClienteRutina>;
  let el: HTMLElement;
  let history: ReturnType<typeof vi.fn<(dni: string) => Observable<RoutineHistoryItem[]>>>;

  function setup(result: () => Observable<RoutineHistoryItem[]> = () => of(HISTORY), dni: string | null = '12345678') {
    history = vi.fn(() => result());
    TestBed.configureTestingModule({
      imports: [ClienteRutina],
      providers: [
        provideFakeClerk(createFakeClerk({ user: fakeUser({ email: 'ana@correo.com' }) })),
        { provide: MeApi, useValue: {} },
        { provide: RoutinesApi, useValue: { history } },
      ],
    });
    TestBed.inject(AuthService).applyMe(testMe({ dni: dni }));
    fixture = TestBed.createComponent(ClienteRutina);
    el = fixture.nativeElement;
    fixture.detectChanges();
  }

  const q = <T extends HTMLElement>(s: string) => el.querySelector(s) as T;
  const qa = (s: string) => Array.from(el.querySelectorAll<HTMLElement>(s));
  const text = (s: string) => q(s).textContent!.replace(/\s+/g, ' ').trim();
  const pill = (day: string) => q<HTMLButtonElement>(`[data-day=${day}]`);

  beforeEach(() => {
    // sábado 19 de septiembre de 2026
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 8, 19, 12, 0));
  });
  afterEach(() => vi.useRealTimers());

  it('pide el historial una sola vez con el DNI del usuario', () => {
    setup();
    expect(history).toHaveBeenCalledTimes(1);
    expect(history).toHaveBeenCalledWith('12345678');
  });

  it('muestra un esqueleto mientras carga', () => {
    setup(() => new Subject<RoutineHistoryItem[]>());
    expect(qa('[data-testid=loading-card]').length + qa('[data-testid=loading-table]').length).toBeGreaterThan(0);
    expect(q('[data-testid=plan-card]')).toBeNull();
  });

  it('hoy (sábado) viene preseleccionado con su bloque y el badge de rutina activa', () => {
    setup();
    expect(pill('saturday').getAttribute('aria-pressed')).toBe('true');
    expect(text('[data-testid=plan-block]')).toBe('Cardio');
    expect(text('[data-testid=plan-kicker]')).toBe('Sábado · Plan del día · Hoy');
    expect(text('[data-testid=plan-card]')).toContain('Rutina activa');
  });

  it.each([
    ['monday', 'Lunes', 'Piernas'],
    ['tuesday', 'Martes', 'Pecho'],
    ['wednesday', 'Miércoles', 'Espalda'],
    ['thursday', 'Jueves', 'Hombros'],
    ['friday', 'Viernes', 'Brazos'],
    ['saturday', 'Sábado', 'Cardio'],
  ])('al elegir %s se ve %s con %s', (day, long, block) => {
    setup();
    pill(day).click();
    fixture.detectChanges();
    expect(pill(day).getAttribute('aria-pressed')).toBe('true');
    expect(text('[data-testid=plan-block]')).toBe(block);
    expect(text('[data-testid=plan-kicker]')).toContain(long);
    expect(history).toHaveBeenCalledTimes(1); // no hay una llamada por día
  });

  it('el domingo es "Descanso", sin badge de rutina activa', () => {
    setup();
    pill('sunday').click();
    fixture.detectChanges();
    expect(text('[data-testid=plan-block]')).toBe('Descanso');
    expect(text('[data-testid=plan-kicker]')).toBe('Domingo · Día de descanso');
    expect(text('[data-testid=plan-card]')).not.toContain('Rutina activa');
    expect(history).toHaveBeenCalledTimes(1);
  });

  it('las pastillas muestran el bloque de la rutina ACTIVA (la última del historial)', () => {
    setup();
    expect(pill('monday').textContent).toContain('Piernas');
    expect(pill('saturday').textContent).toContain('Cardio');
  });

  it('el historial va del más reciente al más antiguo con Activa y Anterior', () => {
    setup();
    const rows = qa('[data-testid=history-row]');
    expect(rows).toHaveLength(2);
    expect(rows[0].textContent).toContain('08 sep 2026');
    expect(rows[0].textContent).toContain('Activa');
    expect(rows[0].textContent).toContain('Piernas · Pecho · Espalda · Hombros · Brazos · Cardio');
    expect(rows[1].textContent).toContain('14 jul 2026');
    expect(rows[1].textContent).toContain('Anterior');
  });

  it('sin rutina (lista vacía) muestra el estado vacío, sin selector de días', () => {
    setup(() => of([]));
    expect(text('[data-testid=empty-state]')).toContain('Aún no tienes una rutina asignada');
    expect(text('[data-testid=empty-state]')).toContain('entrenador o recepción');
    expect(q('[data-testid=day-pills]')).toBeNull();
  });

  it('el 422 de "no encontrado" del backend también es estado vacío (no error)', () => {
    setup(() => throwError(() => new ApiError(422, 'UNPROCESSABLE_ENTITY', 'x', {}, 'DNI not linked')));
    expect(text('[data-testid=empty-state]')).toContain('Aún no tienes una rutina asignada');
    expect(q('[data-testid=retry]')).toBeNull();
  });

  it('un error de servidor muestra el error con "Reintentar", que vuelve a pedir los datos', () => {
    let fail = true;
    setup(() => (fail ? throwError(() => new ApiError(500, 'INTERNAL_ERROR', 'x')) : of(HISTORY)));
    expect(text('[data-testid=empty-state]')).toContain('No pudimos cargar tu rutina');
    fail = false;
    q<HTMLButtonElement>('[data-testid=retry]').click();
    fixture.detectChanges();
    expect(history).toHaveBeenCalledTimes(2);
    expect(text('[data-testid=plan-block]')).toBe('Cardio');
  });

  it('sin red (status 0) también es error con Reintentar', () => {
    setup(() => throwError(() => new ApiError(0, 'NETWORK_ERROR', 'x')));
    expect(q('[data-testid=retry]')).not.toBeNull();
  });

  it('sin DNI conocido muestra el error y no llama al API', () => {
    setup(() => of(HISTORY), null);
    expect(history).not.toHaveBeenCalled();
    expect(q('[data-testid=retry]')).not.toBeNull();
  });
});
