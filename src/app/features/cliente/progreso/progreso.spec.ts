import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Observable, Subject, of, throwError } from 'rxjs';
import { MeApi } from '../../../core/api/me.api';
import { ProgressApi } from '../../../core/api/progress.api';
import { ApiError } from '../../../core/http/api-error';
import { ProgressList } from '../../../core/models';
import { patchDialog } from '../../../testing/dialog';
import { AuthService } from '../../../core/auth/auth.service';
import { createFakeClerk, fakeUser, provideFakeClerk } from '../../../testing/fake-clerk';
import { testMe } from '../../../testing/test-me';
import { ClienteProgreso } from './progreso';

const LIST: ProgressList = {
  total: 4,
  avg_weight_kg: 76.3,
  avg_body_fat_pct: 19.65,
  avg_muscle_pct: 40.975,
  items: [
    { date: '2026-07-06', weight_kg: 78.2, body_fat_pct: 21.0, muscle_pct: 39.8 },
    { date: '2026-08-03', weight_kg: 76.9, body_fat_pct: 20.1, muscle_pct: 40.6 },
    { date: '2026-08-31', weight_kg: 75.6, body_fat_pct: 19.3, muscle_pct: 41.4 },
    { date: '2026-09-15', weight_kg: 74.5, body_fat_pct: 18.2, muscle_pct: 42.1 },
  ],
};
const EMPTY: ProgressList = { items: [], total: 0, avg_weight_kg: 0, avg_body_fat_pct: 0, avg_muscle_pct: 0 };

describe('ClienteProgreso', () => {
  let fixture: ComponentFixture<ClienteProgreso>;
  let el: HTMLElement;
  let list: ReturnType<typeof vi.fn<(dni: string) => Observable<ProgressList>>>;

  function setup(result: () => Observable<ProgressList> = () => of(LIST), dni: string | null = '12345678') {
    list = vi.fn(() => result());
    TestBed.configureTestingModule({
      imports: [ClienteProgreso],
      providers: [
        provideFakeClerk(createFakeClerk({ user: fakeUser({ email: 'ana@correo.com' }) })),
        { provide: MeApi, useValue: {} },
        { provide: ProgressApi, useValue: { list, add: vi.fn() } },
      ],
    });
    TestBed.inject(AuthService).applyMe(testMe({ dni: dni }));
    fixture = TestBed.createComponent(ClienteProgreso);
    el = fixture.nativeElement;
    fixture.detectChanges();
  }

  const q = <T extends HTMLElement>(s: string) => el.querySelector(s) as T;
  const qa = (s: string) => Array.from(el.querySelectorAll<HTMLElement>(s));
  const text = (s: string) => q(s).textContent!.replace(/\s+/g, ' ').trim();
  const metric = (key: string) => q(`[data-metric=${key}]`);

  beforeEach(() => patchDialog());

  it('pide el progreso con el DNI del usuario', () => {
    setup();
    expect(list).toHaveBeenCalledWith('12345678');
  });

  it('muestra esqueletos mientras carga', () => {
    setup(() => new Subject<ProgressList>());
    expect(qa('[data-testid^=loading]').length).toBeGreaterThan(0);
    expect(q('[data-testid=metrics]')).toBeNull();
  });

  it('las tres métricas muestran el último valor, su cambio y su gráfica', () => {
    setup();
    expect(metric('weight').textContent).toContain('74.5');
    expect(metric('weight').textContent).toContain('−1.1 kg');
    expect(metric('fat').textContent).toContain('18.2');
    expect(metric('fat').textContent).toContain('−1.1 pts');
    expect(metric('muscle').textContent).toContain('42.1');
    expect(metric('muscle').textContent).toContain('+0.7 pts');
    expect(metric('weight').querySelectorAll('circle')).toHaveLength(4);
  });

  it('mejorar es verde (peso baja, músculo sube)', () => {
    setup();
    for (const key of ['weight', 'fat', 'muscle']) {
      expect(metric(key).querySelector('.sg-badge-green')).not.toBeNull();
    }
  });

  it('empeorar es azul', () => {
    setup(() =>
      of({
        ...LIST,
        items: [
          { date: '2026-09-14', weight_kg: 74.5, body_fat_pct: 18.2, muscle_pct: 42.1 },
          { date: '2026-09-15', weight_kg: 75.0, body_fat_pct: 18.9, muscle_pct: 41.5 },
        ],
      }),
    );
    for (const key of ['weight', 'fat', 'muscle']) {
      expect(metric(key).querySelector('.sg-badge-blue')).not.toBeNull();
    }
    expect(metric('weight').textContent).toContain('+0.5 kg');
    expect(metric('muscle').textContent).toContain('−0.6 pts');
  });

  it('con un solo registro dice "Sin registro anterior"', () => {
    setup(() => of({ ...LIST, total: 1, items: [LIST.items[3]] }));
    expect(qa('[data-testid=metric-delta]').map((e) => e.textContent!.trim())).toEqual([
      'Sin registro anterior',
      'Sin registro anterior',
      'Sin registro anterior',
    ]);
    // una gráfica de un solo punto no aporta: no se dibuja
    expect(qa('[data-testid=sparkline]')).toHaveLength(0);
  });

  it('el historial va del más reciente al más antiguo, con un decimal', () => {
    setup();
    const rows = qa('[data-testid=progress-row]').map((r) => Array.from(r.querySelectorAll('td')).map((td) => td.textContent!.replace(/\s+/g, ' ').trim()).join(' '));
    expect(rows).toEqual([
      '15 sep 2026 74.5 18.2 42.1',
      '31 ago 2026 75.6 19.3 41.4',
      '03 ago 2026 76.9 20.1 40.6',
      '06 jul 2026 78.2 21.0 39.8',
    ]);
  });

  it('muestra los promedios del API', () => {
    setup();
    expect(text('[data-testid=averages]')).toBe('Promedio: 76.3 kg · 19.7 % grasa · 41.0 % músculo');
  });

  it('sin registros: estado vacío con un botón que abre el diálogo', () => {
    setup(() => of(EMPTY));
    expect(text('[data-testid=empty-state]')).toContain('Aún no registras tu progreso');
    q<HTMLButtonElement>('[data-testid=empty-cta]').click();
    fixture.detectChanges();
    expect(q('dialog').hasAttribute('open')).toBe(true);
  });

  it('el 422 de "no encontrado" también es estado vacío', () => {
    setup(() => throwError(() => new ApiError(422, 'UNPROCESSABLE_ENTITY', 'x', {}, 'DNI not linked')));
    expect(text('[data-testid=empty-state]')).toContain('Aún no registras tu progreso');
  });

  it('error de servidor: mensaje con Reintentar', () => {
    let fail = true;
    setup(() => (fail ? throwError(() => new ApiError(500, 'INTERNAL_ERROR', 'x')) : of(LIST)));
    expect(text('[data-testid=empty-state]')).toContain('No pudimos cargar tu progreso');
    fail = false;
    q<HTMLButtonElement>('[data-testid=retry]').click();
    fixture.detectChanges();
    expect(list).toHaveBeenCalledTimes(2);
    expect(q('[data-testid=metrics]')).not.toBeNull();
  });

  it('el botón "Registrar progreso" del encabezado abre el diálogo', () => {
    setup();
    q<HTMLButtonElement>('[data-testid=open-progress]').click();
    fixture.detectChanges();
    expect(q('dialog').hasAttribute('open')).toBe(true);
  });

  it('tras guardar en el diálogo, refresca los datos sin mostrar el esqueleto', () => {
    let calls = 0;
    setup(() => of(++calls === 1 ? LIST : { ...LIST, total: 5, items: [...LIST.items, { date: '2026-09-19', weight_kg: 74.0, body_fat_pct: 18.0, muscle_pct: 42.5 }] }));
    (fixture.debugElement.query((d) => d.name === 'app-progress-dialog').componentInstance as { saved: { emit: () => void } }).saved.emit();
    fixture.detectChanges();
    expect(list).toHaveBeenCalledTimes(2);
    expect(metric('weight').textContent).toContain('74.0');
  });
});
