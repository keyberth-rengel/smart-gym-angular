import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { EmptyState } from '../empty-state/empty-state';
import { PageHeader } from '../page-header/page-header';

/** Sección aún sin construir: el título sale de `data.title` de la ruta. */
@Component({
  selector: 'app-placeholder-page',
  imports: [PageHeader, EmptyState],
  host: { class: 'sg-page' },
  template: `
    <app-page-header [title]="title" subtitle="Esta sección se construye en una fase posterior." />
    <app-empty-state icon="hammer" [title]="'Próximamente: ' + title" text="Mientras tanto puedes usar el resto del menú." />
  `,
})
export class PlaceholderPage {
  protected readonly title: string = inject(ActivatedRoute).snapshot.data['title'] ?? 'Sección';
}
