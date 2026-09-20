import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PlanGrid } from './plan-grid';

describe('PlanGrid', () => {
  let fixture: ComponentFixture<PlanGrid>;
  const cells = () =>
    Array.from(
      fixture.nativeElement.querySelectorAll('[data-testid=plan-cell]') as NodeListOf<HTMLElement>,
    ).map(
      (c) =>
        `${c.querySelector('.plan-day')!.textContent!.trim()} ${c.querySelector('.plan-block')!.textContent!.trim()}`,
    );

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [PlanGrid] });
    fixture = TestBed.createComponent(PlanGrid);
  });

  it('muestra lunes a sábado con los bloques traducidos (sin domingo)', () => {
    fixture.componentRef.setInput('plan', {
      monday: 'Legs',
      tuesday: 'Chest',
      wednesday: 'Back',
      thursday: 'Shoulders',
      friday: 'Arms',
      saturday: 'Cardio',
    });
    fixture.detectChanges();
    expect(cells()).toEqual([
      'Lunes Piernas',
      'Martes Pecho',
      'Miércoles Espalda',
      'Jueves Hombros',
      'Viernes Brazos',
      'Sábado Cardio',
    ]);
  });

  it('la variante compacta usa el día abreviado', () => {
    fixture.componentRef.setInput('plan', { monday: 'Legs' });
    fixture.componentRef.setInput('compact', true);
    fixture.detectChanges();
    expect(cells()[0]).toBe('Lun Piernas');
    expect(cells()[5]).toBe('Sáb Descanso');
  });

  it('sin plan o con días faltantes muestra "Descanso"', () => {
    fixture.componentRef.setInput('plan', null);
    fixture.detectChanges();
    expect(cells()).toHaveLength(6);
    expect(cells().every((c) => c.endsWith('Descanso'))).toBe(true);
  });

  it('un bloque desconocido se muestra tal cual', () => {
    fixture.componentRef.setInput('plan', { monday: 'Yoga' });
    fixture.detectChanges();
    expect(cells()[0]).toBe('Lunes Yoga');
  });
});
