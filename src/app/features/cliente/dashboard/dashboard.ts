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
import { Observable, catchError, forkJoin, map, of, throwError } from 'rxjs';
import { AttendanceApi } from '../../../core/api/attendance.api';
import { BookingsApi } from '../../../core/api/bookings.api';
import { ProgressApi } from '../../../core/api/progress.api';
import { RoutinesApi } from '../../../core/api/routines.api';
import { TrainersApi } from '../../../core/api/trainers.api';
import { AuthService } from '../../../core/auth/auth.service';
import { ApiError } from '../../../core/http/api-error';
import { AttendanceRecord, ProgressList, RoutineHistoryItem } from '../../../core/models';
import { formatLongDate } from '../../../core/util/dates';
import { PageHeader } from '../../../shared/ui/page-header/page-header';
import { StatCard } from '../../../shared/ui/stat-card/stat-card';
import {
  CardText,
  attendanceCard,
  nextBookingCard,
  progressCard,
  routineCard,
} from './dashboard-view';

type CardKey = 'routine' | 'booking' | 'progress' | 'attendance';
type CardState = { status: 'loading' } | { status: 'error' } | ({ status: 'ready' } & CardText);

const LOADING: CardState = { status: 'loading' };

/** Dashboard del cliente: cuatro tarjetas que cargan y fallan cada una por su lado. */
@Component({
  selector: 'app-cliente-dashboard',
  imports: [RouterLink, PageHeader, StatCard],
  host: { class: 'sg-page' },
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ClienteDashboard {
  private readonly auth = inject(AuthService);
  private readonly routinesApi = inject(RoutinesApi);
  private readonly bookingsApi = inject(BookingsApi);
  private readonly trainersApi = inject(TrainersApi);
  private readonly progressApi = inject(ProgressApi);
  private readonly attendanceApi = inject(AttendanceApi);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly firstName = computed(() => this.auth.fullName()?.split(' ')[0] ?? '');
  protected readonly today = formatLongDate(new Date());

  protected readonly cards = signal<Record<CardKey, CardState>>({
    routine: LOADING,
    booking: LOADING,
    progress: LOADING,
    attendance: LOADING,
  });

  constructor() {
    (['routine', 'booking', 'progress', 'attendance'] as CardKey[]).forEach((k) => this.load(k));
  }

  protected card(key: CardKey): CardState {
    return this.cards()[key];
  }

  protected value(key: CardKey): string {
    const c = this.card(key);
    return c.status === 'ready' ? c.value : '';
  }

  protected sub(key: CardKey): string | undefined {
    const c = this.card(key);
    return c.status === 'ready' ? c.sub : undefined;
  }

  protected load(key: CardKey): void {
    this.cards.update((c) => ({ ...c, [key]: LOADING }));
    this.source(key)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (text) => this.cards.update((c) => ({ ...c, [key]: { status: 'ready', ...text } })),
        error: () => this.cards.update((c) => ({ ...c, [key]: { status: 'error' } })),
      });
  }

  /** "No existe" del backend (404, o 422 de versiones anteriores) equivale a "sin datos". */
  private emptyOn404<T>(err: unknown, empty: T): Observable<T> {
    return err instanceof ApiError && err.isNotFound ? of(empty) : throwError(() => err);
  }

  private source(key: CardKey): Observable<CardText> {
    const dni = this.auth.dni();
    const now = new Date();
    switch (key) {
      case 'routine':
        return this.withDni(dni, (d) =>
          this.routinesApi.history(d).pipe(
            catchError((e) => this.emptyOn404<RoutineHistoryItem[]>(e, [])),
            map((h) => routineCard(h, now)),
          ),
        );
      case 'booking':
        return forkJoin({
          bookings: this.bookingsApi.list(),
          // Sin la lista de entrenadores se muestra el correo, pero la tarjeta no falla.
          trainers: this.trainersApi.list().pipe(catchError(() => of([]))),
        }).pipe(map(({ bookings, trainers }) => nextBookingCard(bookings, trainers, now)));
      case 'progress':
        return this.withDni(dni, (d) =>
          this.progressApi.list(d).pipe(
            catchError((e) => this.emptyOn404<Pick<ProgressList, 'items'>>(e, { items: [] })),
            map((l) => progressCard(l)),
          ),
        );
      case 'attendance':
        return this.withDni(dni, (d) =>
          this.attendanceApi.list(d).pipe(
            catchError((e) => this.emptyOn404<AttendanceRecord[]>(e, [])),
            map((r) => attendanceCard(r, now)),
          ),
        );
    }
  }

  private withDni(
    dni: string | null,
    run: (dni: string) => Observable<CardText>,
  ): Observable<CardText> {
    return dni ? run(dni) : throwError(() => new Error('Sin DNI'));
  }
}
