import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/** Indicador de carga: spinner o esqueleto de tarjeta / tabla. */
@Component({
  selector: 'app-loading',
  template: `
    @switch (variant()) {
      @case ('card') {
        <div
          class="card skeleton-card"
          role="status"
          aria-busy="true"
          [attr.aria-label]="label()"
          data-testid="loading-card"
        >
          <div class="sk sk-title"></div>
          <div class="sk sk-line"></div>
          <div class="sk sk-line short"></div>
        </div>
      }
      @case ('table') {
        <div
          class="card skeleton-table"
          role="status"
          aria-busy="true"
          [attr.aria-label]="label()"
          data-testid="loading-table"
        >
          <div class="sk sk-title"></div>
          @for (row of rowList(); track row) {
            <div class="sk sk-row"></div>
          }
        </div>
      }
      @default {
        <div class="spinner-wrap" role="status" data-testid="loading-spinner">
          <span class="spinner-border" aria-hidden="true"></span>
          <span class="visually-hidden">{{ label() }}</span>
        </div>
      }
    }
  `,
  styles: `
    :host {
      display: block;
    }
    .spinner-wrap {
      display: flex;
      justify-content: center;
      padding: 32px;
    }
    .spinner-border {
      color: var(--sg-accent);
    }
    .skeleton-card,
    .skeleton-table {
      padding: 24px;
      gap: 14px;
    }
    .sk {
      border-radius: 8px;
      background: linear-gradient(
        90deg,
        var(--sg-surface-2) 25%,
        var(--sg-line) 50%,
        var(--sg-surface-2) 75%
      );
      background-size: 200% 100%;
      animation: shimmer 1.4s linear infinite;
    }
    .sk-title {
      height: 24px;
      width: 40%;
    }
    .sk-line {
      height: 16px;
    }
    .sk-line.short {
      width: 60%;
    }
    .sk-row {
      height: 44px;
    }
    @keyframes shimmer {
      to {
        background-position: -200% 0;
      }
    }
    @media (prefers-reduced-motion: reduce) {
      .sk {
        animation: none;
      }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Loading {
  readonly variant = input<'spinner' | 'card' | 'table'>('spinner');
  readonly rows = input(4);
  readonly label = input('Cargando…');

  protected readonly rowList = computed(() => Array.from({ length: this.rows() }, (_, i) => i));
}
