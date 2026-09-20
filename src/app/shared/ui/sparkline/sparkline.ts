import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

export interface SparkPoint {
  x: number;
  y: number;
}

/**
 * Puntos del sparkline dentro de un recuadro `width` x `height` con 4 px de margen.
 * Con un solo valor queda centrado; con todos iguales, en línea recta al medio.
 */
export function sparkPoints(
  values: readonly number[],
  width: number,
  height: number,
): SparkPoint[] {
  const n = values.length;
  if (n === 0) return [];
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const range = hi - lo || 1;
  return values.map((v, i) => ({
    x: n === 1 ? width / 2 : round(4 + (i * (width - 8)) / (n - 1)),
    y: hi === lo ? height / 2 : round(4 + (1 - (v - lo) / range) * (height - 8)),
  }));
}

const round = (n: number) => Math.round(n * 10) / 10;

/** Mini gráfica de línea para una serie corta de valores (decorativa: el dato va en el texto). */
@Component({
  selector: 'app-sparkline',
  template: `
    <svg
      [attr.width]="width()"
      [attr.height]="height()"
      [attr.viewBox]="'0 0 ' + width() + ' ' + height()"
      role="img"
      [attr.aria-label]="label()"
      [class]="'tone-' + tone()"
      data-testid="sparkline"
    >
      @if (points().length > 1) {
        <polyline
          class="line"
          fill="none"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          [attr.points]="polyline()"
        ></polyline>
      }
      @for (p of points(); track $index; let last = $last) {
        <circle class="dot" [attr.cx]="p.x" [attr.cy]="p.y" [attr.r]="last ? 3.2 : 2"></circle>
      }
    </svg>
  `,
  styles: `
    :host {
      display: inline-block;
      line-height: 0;
    }
    .tone-green {
      --spark: var(--sg-accent);
    }
    .tone-blue {
      --spark: var(--sg-blue);
    }
    .line {
      stroke: var(--spark);
    }
    .dot {
      fill: var(--spark);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Sparkline {
  readonly values = input.required<readonly number[]>();
  readonly width = input(110);
  readonly height = input(44);
  readonly tone = input<'green' | 'blue'>('green');
  readonly label = input('Evolución');

  protected readonly points = computed(() =>
    sparkPoints(this.values(), this.width(), this.height()),
  );
  protected readonly polyline = computed(() =>
    this.points()
      .map((p) => `${p.x},${p.y}`)
      .join(' '),
  );
}
