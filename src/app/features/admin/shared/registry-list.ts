import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { filterPeople, sortByName } from '../../../core/util/admin-view';
import { Badge } from '../../../shared/ui/badge/badge';
import { EmptyState } from '../../../shared/ui/empty-state/empty-state';
import { Loading } from '../../../shared/ui/loading/loading';

export interface RegistryColumn {
  key: string;
  label: string;
  /** Alinea a la derecha (números). */
  end?: boolean;
  /** Oculta la columna por debajo del breakpoint `lg` (tablas angostas). */
  hideBelowLg?: boolean;
  /** Texto atenuado con puntos suspensivos (correos). */
  muted?: boolean;
}

export interface RegistryRow {
  email: string;
  name: string;
  [key: string]: string | number | null | undefined;
}

export type RegistryStatus = 'loading' | 'ready' | 'error';

/**
 * Tabla con búsqueda por nombre o correo para los registros del admin (clientes y entrenadores).
 * Es presentacional: recibe los datos ya cargados y avisa "reintentar" / "acción de fila".
 */
@Component({
  selector: 'app-registry-list',
  imports: [Badge, EmptyState, Loading],
  templateUrl: './registry-list.html',
  styleUrl: './registry-list.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RegistryList {
  readonly title = input.required<string>();
  readonly columns = input.required<readonly RegistryColumn[]>();
  readonly rows = input.required<readonly RegistryRow[]>();
  readonly status = input<RegistryStatus>('ready');
  readonly errorTitle = input('No pudimos cargar la lista');
  /** El error fue un 403: el texto habla de permisos y no de la conexión. */
  readonly forbidden = input(false);
  readonly emptyIcon = input('people');
  readonly emptyTitle = input('Aún no hay registros');
  readonly emptyText = input<string>();
  /** Ícono de bootstrap-icons (sin `bi-`) de la acción por fila; sin él no hay columna de acción. */
  readonly actionIcon = input<string>();
  readonly actionLabel = input<(row: RegistryRow) => string>(() => 'Acción');
  /** Correos con la acción en curso (botón deshabilitado, sin doble envío). */
  readonly pending = input<readonly string[]>([]);

  readonly retry = output<void>();
  readonly action = output<RegistryRow>();

  protected readonly query = signal('');
  protected readonly total = computed(() => this.rows().length);
  protected readonly visible = computed(() => filterPeople(sortByName(this.rows()), this.query()));

  protected cell(row: RegistryRow, key: string): string {
    const v = row[key];
    return v === null || v === undefined || v === '' ? '—' : String(v);
  }

  protected isPending(row: RegistryRow): boolean {
    return this.pending().includes(row.email);
  }

  protected onSearch(value: string): void {
    this.query.set(value);
  }
}
