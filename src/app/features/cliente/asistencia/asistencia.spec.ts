import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Observable, Subject, of, throwError } from 'rxjs';
import { AttendanceApi } from '../../../core/api/attendance.api';
import { MeApi } from '../../../core/api/me.api';
import { ApiError } from '../../../core/http/api-error';
import { AttendanceRecord } from '../../../core/models';
import { AuthService } from '../../../core/auth/auth.service';
import { createFakeClerk, fakeUser, provideFakeClerk } from '../../../testing/fake-clerk';
import { testMe } from '../../../testing/test-me';
import { ClienteAsistencia } from './asistencia';

const rec = (id: number, timestamp: string): AttendanceRecord => ({
  id,
  email: 'ana@correo.com',
  role: 'CUSTOMER',
  timestamp,
});
const RECORDS = [
  rec(1, '2026-09-05T17:35:00'),
  rec(2, '2026-09-08T18:15:00'),
  rec(3, '2026-09-19T06:45:00'),
];

describe('ClienteAsistencia', () => {
  let fixture: ComponentFixture<ClienteAsistencia>;
  let el: HTMLElement;
  let list: ReturnType<typeof vi.fn<(dni: string) => Observable<AttendanceRecord[]>>>;
  let access: ReturnType<typeof vi.fn<(dni: string) => Observable<string>>>;

  function setup(
    result: () => Observable<AttendanceRecord[]> = () => of(RECORDS),
    accessResult: () => Observable<string> = () =>
      of('Welcome Ana! Access recorded for ana@correo.com.'),
    dni: string | null = '12345678',
  ) {
    list = vi.fn(() => result());
    access = vi.fn(() => accessResult());
    TestBed.configureTestingModule({
      imports: [ClienteAsistencia],
      providers: [
        provideFakeClerk(
          createFakeClerk({ user: fakeUser({ email: 'ana@correo.com', name: 'Ana Pérez' }) }),
        ),
        { provide: MeApi, useValue: {} },
        { provide: AttendanceApi, useValue: { list, access } },
      ],
    });
    TestBed.inject(AuthService).applyMe(testMe({ dni: dni }));
    fixture = TestBed.createComponent(ClienteAsistencia);
    el = fixture.nativeElement;
    fixture.detectChanges();
  }

  const q = <T extends HTMLElement>(s: string) => el.querySelector(s) as T;
  const qa = (s: string) => Array.from(el.querySelectorAll<HTMLElement>(s));
  const text = (s: string) => q(s).textContent!.replace(/\s+/g, ' ').trim();
  const button = () => q<HTMLButtonElement>('[data-testid=mark-attendance]');

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 8, 19, 6, 45));
  });
  afterEach(() => vi.useRealTimers());

  it('muestra el DNI en solo lectura y no pide ningún dato', () => {
    setup();
    expect(text('[data-testid=att-dni]')).toBe('DNI 12345678');
    expect(el.querySelectorAll('input')).toHaveLength(0);
  });

  it('el historial va del más reciente al más antiguo, numerado desde el primer ingreso', () => {
    setup();
    const rows = qa('[data-testid=att-row]').map((r) =>
      Array.from(r.querySelectorAll('td'))
        .map((td) => td.textContent!.replace(/\s+/g, ' ').trim())
        .join(' '),
    );
    expect(rows).toEqual(['3 19 sep 2026 06:45', '2 08 sep 2026 18:15', '1 05 sep 2026 17:35']);
    expect(text('[data-testid=att-count]')).toBe('3 ingresos');
  });

  it('un solo ingreso se dice en singular', () => {
    setup(() => of([RECORDS[0]]));
    expect(text('[data-testid=att-count]')).toBe('1 ingreso');
  });

  it('ordena aunque el API entregue los registros desordenados', () => {
    setup(() => of([RECORDS[2], RECORDS[0], RECORDS[1]]));
    expect(qa('[data-testid=att-row]')[0].textContent).toContain('19 sep 2026');
  });

  it('sin ingresos: estado vacío', () => {
    setup(() => of([]));
    expect(text('[data-testid=empty-state]')).toContain('Aún no tienes ingresos registrados');
    expect(button()).not.toBeNull(); // el botón principal sigue disponible
  });

  it('esqueleto mientras carga', () => {
    setup(() => new Subject<AttendanceRecord[]>());
    expect(q('[data-testid=loading-table]')).not.toBeNull();
  });

  it('error al cargar: mensaje con Reintentar', () => {
    let fail = true;
    setup(() => (fail ? throwError(() => new ApiError(500, 'INTERNAL_ERROR', 'x')) : of(RECORDS)));
    expect(text('[data-testid=empty-state]')).toContain('No pudimos cargar tu historial');
    fail = false;
    q<HTMLButtonElement>('[data-testid=retry]').click();
    fixture.detectChanges();
    expect(list).toHaveBeenCalledTimes(2);
    expect(qa('[data-testid=att-row]')).toHaveLength(3);
  });

  it('marcar asistencia: llama con el DNI, muestra el mensaje en español con nombre y hora y refresca el historial', () => {
    let calls = 0;
    setup(() => of(++calls === 1 ? RECORDS.slice(0, 2) : RECORDS));
    button().click();
    fixture.detectChanges();
    expect(access).toHaveBeenCalledWith('12345678');
    expect(text('[data-testid=att-success]')).toBe(
      '¡Bienvenido Ana Pérez! Ingreso registrado hoy a las 06:45.',
    );
    expect(text('[data-testid=att-success]')).not.toContain('Welcome');
    expect(list).toHaveBeenCalledTimes(2);
    expect(qa('[data-testid=att-row]')).toHaveLength(3);
    expect(button().disabled).toBe(false);
  });

  it('doble clic: un solo envío mientras está en curso', () => {
    const pending = new Subject<string>();
    setup(undefined, () => pending);
    button().click();
    fixture.detectChanges();
    expect(button().disabled).toBe(true);
    expect(button().textContent).toContain('Registrando');
    button().click();
    fixture.detectChanges();
    expect(access).toHaveBeenCalledTimes(1);
    pending.next('ok');
    pending.complete();
    fixture.detectChanges();
    expect(button().disabled).toBe(false);
  });

  it('al fallar libera el botón, no muestra éxito y permite reintentar', () => {
    let fail = true;
    setup(undefined, () =>
      fail ? throwError(() => new ApiError(500, 'INTERNAL_ERROR', 'x')) : of('ok'),
    );
    button().click();
    fixture.detectChanges();
    expect(q('[data-testid=att-success]')).toBeNull();
    expect(button().disabled).toBe(false);
    fail = false;
    button().click();
    fixture.detectChanges();
    expect(access).toHaveBeenCalledTimes(2);
    expect(q('[data-testid=att-success]')).not.toBeNull();
  });

  it('DNI no vinculado (422 de no encontrado): mensaje en la tarjeta', () => {
    setup(undefined, () =>
      throwError(() => new ApiError(422, 'UNPROCESSABLE_ENTITY', 'x', {}, 'DNI not linked')),
    );
    button().click();
    fixture.detectChanges();
    expect(text('[data-testid=att-failure]')).toContain('no está vinculado');
  });

  it('un nuevo intento limpia el mensaje anterior', () => {
    setup();
    button().click();
    fixture.detectChanges();
    expect(q('[data-testid=att-success]')).not.toBeNull();
    access.mockReturnValueOnce(throwError(() => new ApiError(500, 'INTERNAL_ERROR', 'x')));
    button().click();
    fixture.detectChanges();
    expect(q('[data-testid=att-success]')).toBeNull();
  });

  it('sin DNI conocido no llama al API y muestra error', () => {
    setup(undefined, undefined, null);
    expect(list).not.toHaveBeenCalled();
    button().click();
    expect(access).not.toHaveBeenCalled();
  });
});
