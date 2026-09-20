import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { BadgeTone } from '../../../core/nav/nav-items';

/** Etiqueta pequeña de estado, sobre las clases `.sg-badge` del tema. */
@Component({
  selector: 'app-badge',
  template: `<span class="sg-badge" [class]="'sg-badge sg-badge-' + tone()"><ng-content /></span>`,
  styles: `
    :host {
      display: inline-flex;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Badge {
  readonly tone = input<BadgeTone>('gray');
}
