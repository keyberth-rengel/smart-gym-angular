import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subscription } from 'rxjs';
import { TrainersApi } from '../../../core/api/trainers.api';
import { AuthService } from '../../../core/auth/auth.service';
import { skipErrorToast } from '../../../core/http/error.interceptor';
import { Booking, TrainerCustomer } from '../../../core/models';
import { toIsoDate } from '../../../core/util/dates';
import {
  addDays,
  agendaRows,
  dayHeading,
  groupByDate,
  weekDays,
  weekRangeLabel,
  weekStart,
} from '../../../core/util/trainer-view';
import { Badge } from '../../../shared/ui/badge/badge';
import { EmptyState } from '../../../shared/ui/empty-state/empty-state';
import { Loading } from '../../../shared/ui/loading/loading';
import { PageHeader } from '../../../shared/ui/page-header/page-header';

type ViewState = 'loading' | 'error' | 'ready';

/** Mis citas: tira semanal (lunes a domingo) y la lista de citas del día elegido. */
@Component({
  selector: 'app-entrenador-citas',
  imports: [PageHeader, Badge, EmptyState, Loading],
  host: { class: 'sg-page' },
  templateUrl: './citas.html',
  styleUrl: './citas.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EntrenadorCitas {
  private readonly auth = inject(AuthService);
  private readonly trainersApi = inject(TrainersApi);
  private readonly destroyRef = inject(DestroyRef);

  private readonly now = signal(new Date());
  protected readonly start = signal(weekStart(new Date()));
  protected readonly selected = signal(toIsoDate(new Date()));

  protected readonly state = signal<ViewState>('loading');
  private readonly bookings = signal<Booking[]>([]);
  /** Solo sirve para mostrar nombres: si no carga, se muestran los correos. */
  private readonly customers = signal<TrainerCustomer[]>([]);

  private weekRequest: Subscription | null = null;

  protected readonly days = computed(() => {
    const byDate = groupByDate(this.bookings());
    return weekDays(this.start(), this.now()).map((d) => ({
      ...d,
      count: byDate.get(d.iso)?.length ?? 0,
    }));
  });
  protected readonly rangeLabel = computed(() => weekRangeLabel(this.start()));
  protected readonly isCurrentWeek = computed(() => this.days().some((d) => d.isToday));

  private readonly selectedDay = computed(
    () => this.days().find((d) => d.iso === this.selected()) ?? this.days()[0],
  );
  protected readonly heading = computed(() => dayHeading(this.selectedDay().date));
  protected readonly isToday = computed(() => this.selectedDay().isToday);

  protected readonly rows = computed(() => {
    const day = this.selectedDay();
    const list = groupByDate(this.bookings()).get(day.iso) ?? [];
    const rows = agendaRows(list, this.customers(), this.now());
    // "Próxima" solo aplica a la siguiente cita de hoy.
    return rows.map((r) => ({ ...r, next: day.isToday && r.next }));
  });
  protected readonly countLabel = computed(() => {
    const n = this.rows().length;
    return n === 0 ? 'Sin citas' : n === 1 ? '1 cita' : `${n} citas`;
  });

  constructor() {
    this.loadCustomers();
    this.loadWeek();
  }

  protected shiftWeek(delta: number): void {
    const start = addDays(this.start(), delta * 7);
    this.goToWeek(start);
  }

  protected goToday(): void {
    this.goToWeek(weekStart(new Date()));
  }

  private goToWeek(start: Date): void {
    this.now.set(new Date());
    this.start.set(start);
    const today = toIsoDate(this.now());
    const inWeek = this.days().find((d) => d.iso === today);
    // La semana actual abre en hoy; cualquier otra, en su lunes.
    this.selected.set(inWeek ? inWeek.iso : this.days()[0].iso);
    this.loadWeek();
  }

  protected select(iso: string): void {
    this.selected.set(iso);
  }

  protected loadWeek(): void {
    const email = this.auth.email();
    if (!email) return;
    this.now.set(new Date());
    this.weekRequest?.unsubscribe();
    this.state.set('loading');
    const days = this.days();
    this.weekRequest = this.trainersApi
      .bookings(email, { from: days[0].iso, to: days[6].iso })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (bookings) => {
          this.bookings.set(bookings);
          this.state.set('ready');
        },
        error: () => {
          this.bookings.set([]);
          this.state.set('error');
        },
      });
  }

  private loadCustomers(): void {
    const email = this.auth.email();
    if (!email) return;
    this.trainersApi
      .customers(email, skipErrorToast())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({ next: (c) => this.customers.set(c), error: () => this.customers.set([]) });
  }
}
