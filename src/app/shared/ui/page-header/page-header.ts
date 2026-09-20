import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/** Título de página (Barlow Condensed) con subtítulo y un espacio para acciones. */
@Component({
  selector: 'app-page-header',
  template: `
    <div class="page-header">
      <div class="page-titles">
        <h1 class="page-title" data-testid="page-title">{{ title() }}</h1>
        @if (subtitle()) {
          <p class="page-subtitle" data-testid="page-subtitle">{{ subtitle() }}</p>
        }
      </div>
      <div class="page-actions"><ng-content select="[actions]" /></div>
    </div>
  `,
  styles: `
    :host {
      display: block;
    }
    .page-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 16px;
    }
    .page-title {
      margin: 0;
      font-size: 2.5rem;
      line-height: 1.05;
    }
    .page-subtitle {
      margin: 2px 0 0;
      font-size: 1rem;
      color: var(--sg-muted);
    }
    .page-actions:empty {
      display: none;
    }
    @media (max-width: 767.98px) {
      .page-title {
        font-size: 2.125rem;
      }
      .page-subtitle {
        font-size: 0.9375rem;
      }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PageHeader {
  readonly title = input.required<string>();
  readonly subtitle = input<string>();
}
