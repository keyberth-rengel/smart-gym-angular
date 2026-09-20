import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';

/** Tarjeta de dato: ícono, etiqueta, valor grande, subtexto y un enlace opcional. */
@Component({
  selector: 'app-stat-card',
  imports: [RouterLink],
  templateUrl: './stat-card.html',
  styleUrl: './stat-card.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StatCard {
  /** Nombre de bootstrap-icons sin `bi-`. */
  readonly icon = input.required<string>();
  readonly label = input.required<string>();
  readonly value = input.required<string>();
  readonly sub = input<string>();
  readonly tone = input<'green' | 'blue'>('green');
  readonly linkText = input<string>();
  readonly linkTo = input<string>();
  /** `loading` muestra un esqueleto y `error` un aviso con "Reintentar" (cada tarjeta carga sola). */
  readonly status = input<'ready' | 'loading' | 'error'>('ready');
  readonly retry = output<void>();

  /** Los valores en texto ("Sin reservas próximas") usan una letra menor en móvil para no ocupar 3 líneas. */
  protected readonly longValue = computed(() => this.value().length > 11);
}
