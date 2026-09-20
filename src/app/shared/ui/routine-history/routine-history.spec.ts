import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RoutineHistory } from './routine-history';

describe('RoutineHistory', () => {
  let fixture: ComponentFixture<RoutineHistory>;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [RoutineHistory] });
    fixture = TestBed.createComponent(RoutineHistory);
  });

  const rows = () =>
    Array.from(
      fixture.nativeElement.querySelectorAll(
        '[data-testid=history-row]',
      ) as NodeListOf<HTMLElement>,
    );

  it('una fila por rutina con fecha, resumen y la etiqueta Activa o Anterior', () => {
    fixture.componentRef.setInput('entries', [
      {
        createdAt: '2026-09-08T10:00:00',
        date: '08 sep 2026',
        summary: 'Piernas · Pecho',
        active: true,
      },
      {
        createdAt: '2026-07-14T10:00:00',
        date: '14 jul 2026',
        summary: 'Cardio · Espalda',
        active: false,
      },
    ]);
    fixture.detectChanges();
    expect(rows()).toHaveLength(2);
    const t = rows().map((r) =>
      ['.hist-date', '.hist-summary', '.sg-badge']
        .map((sel) => r.querySelector(sel)!.textContent!.trim())
        .join(' '),
    );
    expect(t[0]).toBe('08 sep 2026 Piernas · Pecho Activa');
    expect(t[1]).toBe('14 jul 2026 Cardio · Espalda Anterior');
  });

  it('sin rutinas no dibuja filas', () => {
    fixture.componentRef.setInput('entries', []);
    fixture.detectChanges();
    expect(rows()).toHaveLength(0);
  });
});
