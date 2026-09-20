import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  Injector,
  afterNextRender,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { firstValueFrom } from 'rxjs';
import { BookingsApi } from '../../../core/api/bookings.api';
import { CustomersApi } from '../../../core/api/customers.api';
import { TrainersApi } from '../../../core/api/trainers.api';
import { ApiError } from '../../../core/http/api-error';
import { skipErrorToast } from '../../../core/http/error.interceptor';
import { Booking, Customer, Trainer } from '../../../core/models';
import {
  AdminBookingRow,
  adminBookingRows,
  bookingSummary,
  filterBookings,
  trainerOptions,
} from '../../../core/util/admin-view';
import { toIsoDate } from '../../../core/util/dates';
import { Badge } from '../../../shared/ui/badge/badge';
import { ConfirmService } from '../../../shared/ui/confirm/confirm.service';
import { EmptyState } from '../../../shared/ui/empty-state/empty-state';
import { Loading } from '../../../shared/ui/loading/loading';
import { PageHeader } from '../../../shared/ui/page-header/page-header';
import { ToastService } from '../../../shared/ui/toast/toast.service';

type Status = 'loading' | 'ready' | 'error';

/**
 * Reservas del admin: una sola llamada a `GET /bookings` (el admin recibe todas) y los filtros de
 * entrenador y fecha se aplican en el cliente. Los nombres salen de `/customers` y `/trainers`;
 * si esas cargas fallan, la tabla sigue funcionando con los correos.
 */
@Component({
  selector: 'app-admin-reservas',
  imports: [PageHeader, Badge, EmptyState, Loading],
  host: { class: 'sg-page' },
  templateUrl: './reservas.html',
  styleUrl: './reservas.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminReservas {
  private readonly bookingsApi = inject(BookingsApi);
  private readonly customersApi = inject(CustomersApi);
  private readonly trainersApi = inject(TrainersApi);
  private readonly confirm = inject(ConfirmService);
  private readonly toasts = inject(ToastService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly injector = inject(Injector);

  protected readonly status = signal<Status>('loading');
  /** El error de carga fue un 403 (la cuenta no es admin). */
  protected readonly forbidden = signal(false);
  private readonly bookings = signal<Booking[]>([]);
  private readonly customers = signal<Customer[]>([]);
  private readonly trainers = signal<Trainer[]>([]);
  private readonly now = signal(new Date());

  protected readonly trainerFilter = signal('');
  protected readonly dateFilter = signal(toIsoDate(new Date()));
  protected readonly hasFilters = computed(() => !!this.trainerFilter() || !!this.dateFilter());

  protected readonly trainerChoices = computed(() =>
    trainerOptions(this.trainers(), this.bookings()),
  );
  protected readonly total = computed(() => this.bookings().length);
  protected readonly rows = computed(() =>
    adminBookingRows(
      filterBookings(this.bookings(), {
        trainerEmail: this.trainerFilter(),
        date: this.dateFilter(),
      }),
      this.customers(),
      this.trainers(),
      this.now(),
    ),
  );

  /** Ids con la cancelación en curso (botón deshabilitado con indicador). */
  protected readonly sending = signal<readonly number[]>([]);
  /** Ids con la cancelación pedida (incluida la confirmación): evita el doble envío. */
  private readonly guard = new Set<number>();

  constructor() {
    this.load();
    this.loadNames();
  }

  protected load(silent = false): void {
    if (!silent) this.status.set('loading');
    this.forbidden.set(false);
    this.bookingsApi
      .list()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (list) => {
          this.now.set(new Date());
          this.bookings.set(list);
          this.status.set('ready');
        },
        error: (err: unknown) => {
          this.forbidden.set(err instanceof ApiError && err.status === 403);
          // una recarga silenciosa que falla conserva la tabla que ya se mostraba
          if (!silent || !this.bookings().length) this.status.set('error');
        },
      });
  }

  /** Nombres para las columnas y el filtro; sin ellos se muestran los correos. */
  private loadNames(): void {
    this.customersApi
      .list(skipErrorToast())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({ next: (l) => this.customers.set(l), error: () => undefined });
    this.trainersApi
      .list(skipErrorToast())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({ next: (l) => this.trainers.set(l), error: () => undefined });
  }

  protected onTrainer(email: string): void {
    this.trainerFilter.set(email);
  }

  protected onDate(value: string): void {
    this.dateFilter.set(value);
  }

  /** "Filtrar" también vuelve a pedir las reservas, por si hubo cambios desde otro equipo. */
  protected refresh(): void {
    this.load(true);
    this.loadNames();
  }

  protected clearFilters(): void {
    this.trainerFilter.set('');
    this.dateFilter.set('');
  }

  protected isSending(id: number): boolean {
    return this.sending().includes(id);
  }

  protected async cancel(row: AdminBookingRow): Promise<void> {
    if (this.guard.has(row.id)) return;
    this.guard.add(row.id);
    try {
      const ok = await this.confirm.confirm({
        title: `¿Cancelar la reserva #${row.id}?`,
        message: `${bookingSummary(row)}. Esta acción no se puede deshacer.`,
        confirmLabel: 'Cancelar reserva',
        cancelLabel: 'Volver',
        danger: true,
      });
      if (!ok) return;
      this.sending.update((l) => [...l, row.id]);
      await firstValueFrom(this.bookingsApi.cancel(row.id));
      this.toasts.success(`Cancelaste la reserva #${row.id}.`, 'Reserva cancelada');
      this.afterChange();
    } catch (err) {
      // 403, red caída y 5xx ya muestran su toast (interceptor) y la fila permanece.
      if (err instanceof ApiError && err.isNotFound) {
        this.toasts.warning('La reserva ya no existe o ya fue cancelada.', 'Reserva no encontrada');
        this.afterChange();
      }
    } finally {
      this.sending.update((l) => l.filter((id) => id !== row.id));
      this.guard.delete(row.id);
    }
  }

  /** Recarga la lista y deja el foco en el título de la tarjeta (la fila cancelada ya no está). */
  private afterChange(): void {
    this.load(true);
    afterNextRender(
      () => {
        const active = document.activeElement;
        if (!active || active === document.body) {
          document.getElementById('bookings-title')?.focus();
        }
      },
      { injector: this.injector },
    );
  }
}
