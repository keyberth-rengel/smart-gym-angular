import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/** Estado vacío: ícono, título, texto y un espacio para la acción principal. */
@Component({
  selector: 'app-empty-state',
  template: `
    <div class="empty" data-testid="empty-state">
      <span class="empty-icon" aria-hidden="true"><i class="bi" [class]="'bi-' + icon()"></i></span>
      <h2 class="empty-title">{{ title() }}</h2>
      @if (text()) {
        <p class="empty-text">{{ text() }}</p>
      }
      <div class="empty-cta"><ng-content /></div>
    </div>
  `,
  styles: `
    :host {
      display: block;
    }
    .empty {
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
      gap: 10px;
      padding: 48px 24px;
      background: var(--sg-surface);
      border: 1px dashed var(--sg-input-border);
      border-radius: 16px;
    }
    .empty-icon {
      width: 56px;
      height: 56px;
      border-radius: 50%;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      background: var(--sg-surface-2);
      color: var(--sg-muted);
      font-size: 1.6rem;
    }
    .empty-title {
      margin: 6px 0 0;
      font-size: 1.5rem;
    }
    .empty-text {
      margin: 0;
      max-width: 420px;
      color: var(--sg-muted);
    }
    .empty-cta:empty {
      display: none;
    }
    .empty-cta {
      margin-top: 8px;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EmptyState {
  readonly icon = input('inbox');
  readonly title = input.required<string>();
  readonly text = input<string>();
}
