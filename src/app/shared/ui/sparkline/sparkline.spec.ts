import { TestBed } from '@angular/core/testing';
import { Sparkline, sparkPoints } from './sparkline';

describe('sparkPoints', () => {
  it('sin valores no hay puntos', () => {
    expect(sparkPoints([], 110, 44)).toEqual([]);
  });

  it('un solo valor queda centrado', () => {
    expect(sparkPoints([70], 110, 44)).toEqual([{ x: 55, y: 22 }]);
  });

  it('valores iguales quedan en línea recta al medio', () => {
    const pts = sparkPoints([5, 5, 5], 110, 44);
    expect(pts.map((p) => p.y)).toEqual([22, 22, 22]);
    expect(pts.map((p) => p.x)).toEqual([4, 55, 106]);
  });

  it('el mínimo va abajo y el máximo arriba, con 4 px de margen', () => {
    const pts = sparkPoints([78.2, 76.9, 75.6, 74.5], 110, 44);
    expect(pts[0]).toEqual({ x: 4, y: 4 });
    expect(pts[3]).toEqual({ x: 106, y: 40 });
    // decrece de forma monótona (y aumenta hacia abajo)
    expect(pts[1].y).toBeGreaterThan(pts[0].y);
    expect(pts[2].y).toBeGreaterThan(pts[1].y);
    expect(pts[3].y).toBeGreaterThan(pts[2].y);
  });

  it('respeta un tamaño distinto', () => {
    const pts = sparkPoints([1, 2], 60, 20);
    expect(pts).toEqual([{ x: 4, y: 16 }, { x: 56, y: 4 }]);
  });
});

describe('Sparkline', () => {
  function render(values: number[], tone: 'green' | 'blue' = 'green') {
    const fixture = TestBed.createComponent(Sparkline);
    fixture.componentRef.setInput('values', values);
    fixture.componentRef.setInput('tone', tone);
    fixture.componentRef.setInput('label', 'Evolución de peso');
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('dibuja la línea y un punto por valor, con el último más grande', () => {
    const el = render([78.2, 76.9, 75.6, 74.5]);
    expect(el.querySelectorAll('polyline')).toHaveLength(1);
    const dots = el.querySelectorAll('circle');
    expect(dots).toHaveLength(4);
    expect(dots[0].getAttribute('r')).toBe('2');
    expect(dots[3].getAttribute('r')).toBe('3.2');
  });

  it('un solo valor: solo el punto, sin línea', () => {
    const el = render([70]);
    expect(el.querySelectorAll('polyline')).toHaveLength(0);
    expect(el.querySelectorAll('circle')).toHaveLength(1);
  });

  it('es accesible: role img con etiqueta, y el tono va como clase', () => {
    const el = render([1, 2], 'blue');
    const svg = el.querySelector('svg')!;
    expect(svg.getAttribute('role')).toBe('img');
    expect(svg.getAttribute('aria-label')).toBe('Evolución de peso');
    expect(svg.getAttribute('class')).toContain('tone-blue');
  });
});
