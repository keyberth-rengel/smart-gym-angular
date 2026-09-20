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
import { AttendanceApi } from '../../../core/api/attendance.api';
import { TrainersApi } from '../../../core/api/trainers.api';
import { AuthService } from '../../../core/auth/auth.service';
import { ApiError } from '../../../core/http/api-error';
import { Booking, TrainerCustomer } from '../../../core/models';
import { formatLongDate, formatTime, toIsoDate } from '../../../core/util/dates';
import { agendaRows } from '../../../core/util/trainer-view';
import { EmptyState } from '../../../shared/ui/empty-state/empty-state';
import { Loading } from '../../../shared/ui/loading/loading';
import { PageHeader } from '../../../shared/ui/page-header/page-header';
import { StatCard } from '../../../shared/ui/stat-card/stat-card';

type Status = 'loading' | 'ready' | 'error';
interface Res<T> {
  status: Status;
  data: T;
}

/**
 * Dashboard del entrenador: citas de hoy, clientes asociados, próxima cita y agenda.
 * Las citas y los clientes se cargan por separado: si una falla, lo demás sigue visible.
 */
@Component({
  selector: 'app-entrenador-dashboard',
  imports: [RouterLink, PageHeader, StatCard, EmptyState, Loading],
  host: { class: 'sg-page' },
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EntrenadorDashboard {
  private readonly auth = inject(AuthService);
  private readonly trainersApi = inject(TrainersApi);
  private readonly attendanceApi = inject(AttendanceApi);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly dni = this.auth.dni;
  protected readonly firstName = computed(() => this.auth.fullName()?.split(' ')[0] ?? '');
  protected readonly today = formatLongDate(new Date());

  private readonly now = signal(new Date());
  protected readonly bookings = signal<Res<Booking[]>>({ status: 'loading', data: [] });
  protected readonly customers = signal<Res<TrainerCustomer[]>>({ status: 'loading', data: [] });

  /** Citas de hoy con el nombre del cliente; la próxima queda marcada. */
  protected readonly agenda = computed(() =>
    agendaRows(this.bookings().data, this.customers().data, this.now()),
  );
  private readonly next = computed(() => this.agenda().find((r) => r.next) ?? null);

  protected readonly todayCard = computed(() => {
    const n = this.agenda().length;
    const next = this.next();
    return {
      value: String(n),
      sub: n === 0 ? 'Sin citas hoy' : next ? `Próxima a las ${next.time}` : 'Sin citas próximas',
    };
  });

  protected readonly customersCard = computed(() => {
    const n = this.customers().data.length;
    return {
      value: String(n),
      sub: n === 0 ? 'Aún no tienes clientes' : 'Con al menos una sesión',
    };
  });

  protected readonly nextCard = computed(() => {
    const next = this.next();
    return next
      ? { value: next.time, sub: `con ${next.name}` }
      : { value: 'Sin citas próximas', sub: 'Hoy no quedan citas' };
  });

  /** `true` mientras se envía el ingreso: evita el doble envío. */
  protected readonly submitting = signal(false);
  protected readonly success = signal<string | null>(null);
  protected readonly failure = signal<string | null>(null);

  constructor() {
    this.loadBookings();
    this.loadCustomers();
  }

  protected loadBookings(): void {
    const email = this.auth.email();
    if (!email) return;
    this.now.set(new Date());
    this.bookings.update((b) => ({ ...b, status: 'loading' }));
    this.trainersApi
      .bookings(email, { date: toIsoDate(this.now()) })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (data) => this.bookings.set({ status: 'ready', data }),
        error: () => this.bookings.set({ status: 'error', data: [] }),
      });
  }

  protected loadCustomers(): void {
    const email = this.auth.email();
    if (!email) return;
    this.customers.update((c) => ({ ...c, status: 'loading' }));
    this.trainersApi
      .customers(email)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (data) => this.customers.set({ status: 'ready', data }),
        error: () => this.customers.set({ status: 'error', data: [] }),
      });
  }

  protected markAttendance(): void {
    const dni = this.dni();
    if (this.submitting() || !dni) return;
    this.submitting.set(true);
    this.success.set(null);
    this.failure.set(null);
    this.attendanceApi
      .access(dni)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.submitting.set(false);
          const name = this.auth.fullName() ?? '';
          this.success.set(
            `¡Bienvenido ${name}! Ingreso registrado a las ${formatTime(new Date())}.`,
          );
        },
        error: (err: unknown) => {
          this.submitting.set(false);
          // 5xx, red y 422 los avisa el interceptor; aquí solo el "no vinculado".
          if (err instanceof ApiError && err.isNotFound) {
            this.failure.set('Este DNI no está vinculado a ninguna cuenta de SmartGym.');
          }
        },
      });
  }
}
