import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { BookingsApi } from '../../../core/api/bookings.api';
import { CustomersApi } from '../../../core/api/customers.api';
import { HealthApi } from '../../../core/api/health.api';
import { TrainersApi } from '../../../core/api/trainers.api';
import { skipErrorToast } from '../../../core/http/error.interceptor';
import { Booking, Customer, Trainer } from '../../../core/models';
import { todayBookings } from '../../../core/util/admin-view';
import { formatLongDate } from '../../../core/util/dates';
import { EmptyState } from '../../../shared/ui/empty-state/empty-state';
import { Loading } from '../../../shared/ui/loading/loading';
import { PageHeader } from '../../../shared/ui/page-header/page-header';

type Status = 'loading' | 'ready' | 'error';
type HealthState = 'checking' | 'up' | 'down';

interface ModuleCard {
  icon: string;
  title: string;
  text: string;
  path: string;
}

/**
 * Dashboard del admin: estado del servicio, accesos a los módulos y las reservas de hoy.
 * El estado del servicio, las reservas y los nombres se cargan por separado: si una llamada
 * falla, lo demás sigue visible (sin nombres se muestran los correos).
 */
@Component({
  selector: 'app-admin-dashboard',
  imports: [RouterLink, PageHeader, EmptyState, Loading],
  host: { class: 'sg-page' },
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminDashboard {
  private readonly health = inject(HealthApi);
  private readonly bookingsApi = inject(BookingsApi);
  private readonly customersApi = inject(CustomersApi);
  private readonly trainersApi = inject(TrainersApi);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly today = formatLongDate(new Date());
  protected readonly modules: readonly ModuleCard[] = [
    {
      icon: 'people',
      title: 'Clientes',
      text: 'Registrar y consultar socios',
      path: '/admin/clientes',
    },
    {
      icon: 'person-badge',
      title: 'Entrenadores',
      text: 'Registrar y consultar equipo',
      path: '/admin/entrenadores',
    },
    {
      icon: 'calendar-event',
      title: 'Reservas',
      text: 'Consultar y cancelar sesiones',
      path: '/admin/reservas',
    },
    {
      icon: 'lightning-charge',
      title: 'Rutinas',
      text: 'Asignar plan semanal por DNI',
      path: '/admin/rutinas',
    },
    {
      icon: 'check2-circle',
      title: 'Asistencia',
      text: 'Registrar ingresos por DNI',
      path: '/admin/asistencia',
    },
  ];

  protected readonly healthState = signal<HealthState>('checking');
  protected readonly bookingsStatus = signal<Status>('loading');
  private readonly bookings = signal<Booking[]>([]);
  private readonly customers = signal<Customer[]>([]);
  private readonly trainers = signal<Trainer[]>([]);
  private readonly now = signal(new Date());

  protected readonly rows = computed(() =>
    todayBookings(this.bookings(), this.customers(), this.trainers(), this.now()),
  );

  constructor() {
    this.checkHealth();
    this.loadBookings();
    this.loadNames();
  }

  protected checkHealth(): void {
    this.healthState.set('checking');
    this.health
      .check(skipErrorToast())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (h) => this.healthState.set(String(h?.status).toUpperCase() === 'UP' ? 'up' : 'down'),
        error: () => this.healthState.set('down'),
      });
  }

  protected loadBookings(): void {
    this.now.set(new Date());
    this.bookingsStatus.set('loading');
    this.bookingsApi
      .list()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (list) => {
          this.bookings.set(list);
          this.bookingsStatus.set('ready');
        },
        error: () => this.bookingsStatus.set('error'),
      });
  }

  /** Nombres para la tabla; si fallan, la tabla muestra los correos (sin mensaje de error propio). */
  private loadNames(): void {
    this.customersApi
      .list(skipErrorToast())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({ next: (list) => this.customers.set(list), error: () => undefined });
    this.trainersApi
      .list()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({ next: (list) => this.trainers.set(list), error: () => undefined });
  }
}
