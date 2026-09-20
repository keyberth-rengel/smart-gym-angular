import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { ProgressApi } from '../../../core/api/progress.api';
import { RoutinesApi } from '../../../core/api/routines.api';
import { TrainersApi } from '../../../core/api/trainers.api';
import { AuthService } from '../../../core/auth/auth.service';
import { ApiError } from '../../../core/http/api-error';
import { skipErrorToast } from '../../../core/http/error.interceptor';
import { ProgressItem, RoutineHistoryItem, TrainerCustomer } from '../../../core/models';
import { formatDate } from '../../../core/util/dates';
import { customerLastLabel, filterCustomers, initials } from '../../../core/util/trainer-view';
import { activePlan } from '../../cliente/rutina/routine-view';
import { fmt, sortAscending } from '../../cliente/progreso/progress-stats';
import { Badge } from '../../../shared/ui/badge/badge';
import { EmptyState } from '../../../shared/ui/empty-state/empty-state';
import { Loading } from '../../../shared/ui/loading/loading';
import { PageHeader } from '../../../shared/ui/page-header/page-header';
import { PlanGrid } from '../../../shared/ui/plan-grid/plan-grid';

type ListState = 'loading' | 'error' | 'empty' | 'ready';
/** Estado de un bloque del detalle: cada uno carga y falla por su lado. */
type BlockState = 'loading' | 'ready' | 'empty' | 'forbidden' | 'error';

/** Mis clientes: tabla con búsqueda y, al elegir uno, su último progreso y su rutina activa. */
@Component({
  selector: 'app-entrenador-clientes',
  imports: [PageHeader, Badge, EmptyState, Loading, PlanGrid],
  host: { class: 'sg-page' },
  templateUrl: './clientes.html',
  styleUrl: './clientes.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EntrenadorClientes {
  private readonly auth = inject(AuthService);
  private readonly trainersApi = inject(TrainersApi);
  private readonly progressApi = inject(ProgressApi);
  private readonly routinesApi = inject(RoutinesApi);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  private readonly now = signal(new Date());
  protected readonly state = signal<ListState>('loading');
  private readonly customers = signal<TrainerCustomer[]>([]);

  protected readonly query = signal('');
  protected readonly selectedEmail = signal<string | null>(null);

  protected readonly rows = computed(() =>
    filterCustomers(this.customers(), this.query()).map((c) => ({
      ...c,
      last: customerLastLabel(c, this.now()),
    })),
  );
  protected readonly total = computed(() => this.customers().length);
  protected readonly selected = computed(
    () => this.customers().find((c) => c.email === this.selectedEmail()) ?? null,
  );
  protected readonly selectedInitials = computed(() => initials(this.selected()?.name ?? ''));

  // Detalle del cliente elegido.
  protected readonly progressState = signal<BlockState>('loading');
  protected readonly routineState = signal<BlockState>('loading');
  private readonly progress = signal<ProgressItem[]>([]);
  private readonly history = signal<RoutineHistoryItem[]>([]);
  private detailRequests: Subscription[] = [];

  protected readonly latest = computed(() => {
    const last = sortAscending(this.progress()).at(-1);
    return last
      ? {
          date: formatDate(last.date),
          weight: fmt(last.weight_kg),
          fat: fmt(last.body_fat_pct),
          muscle: fmt(last.muscle_pct),
        }
      : null;
  });
  protected readonly plan = computed(() => activePlan(this.history()));

  constructor() {
    this.loadList();
  }

  protected loadList(): void {
    const email = this.auth.email();
    if (!email) return;
    this.now.set(new Date());
    this.state.set('loading');
    this.trainersApi
      .customers(email)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (list) => {
          this.customers.set(list);
          this.state.set(list.length ? 'ready' : 'empty');
          if (list.length && !this.selected()) this.select(list[0].email);
        },
        error: () => {
          this.customers.set([]);
          this.state.set('error');
        },
      });
  }

  protected onSearch(value: string): void {
    this.query.set(value);
  }

  protected clearSearch(): void {
    this.query.set('');
  }

  protected select(email: string): void {
    this.selectedEmail.set(email);
    this.loadProgress();
    this.loadRoutine();
  }

  /** Un 403 (cliente que no es suyo) o un "no existe" no rompe la pantalla: se avisa en el bloque. */
  private blockError(err: unknown): BlockState {
    if (err instanceof ApiError) {
      if (err.status === 403) return 'forbidden';
      if (err.isNotFound) return 'empty';
    }
    return 'error';
  }

  protected loadProgress(): void {
    const email = this.selectedEmail();
    if (!email) return;
    this.progressState.set('loading');
    const sub = this.progressApi
      .listByEmail(email, skipErrorToast())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (l) => {
          this.progress.set(l.items);
          this.progressState.set(l.items.length ? 'ready' : 'empty');
        },
        error: (err: unknown) => {
          this.progress.set([]);
          this.progressState.set(this.blockError(err));
        },
      });
    this.track(sub, 0);
  }

  protected loadRoutine(): void {
    const email = this.selectedEmail();
    if (!email) return;
    this.routineState.set('loading');
    const sub = this.routinesApi
      .historyByEmail(email, skipErrorToast())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (h) => {
          this.history.set(h);
          this.routineState.set(h.length ? 'ready' : 'empty');
        },
        error: (err: unknown) => {
          this.history.set([]);
          this.routineState.set(this.blockError(err));
        },
      });
    this.track(sub, 1);
  }

  /** Cancela la petición anterior del mismo bloque: una respuesta tardía no pisa al cliente actual. */
  private track(sub: Subscription, slot: 0 | 1): void {
    this.detailRequests[slot]?.unsubscribe();
    this.detailRequests[slot] = sub;
  }

  protected assignRoutine(): void {
    const email = this.selectedEmail();
    if (email)
      void this.router.navigate(['/entrenador/rutinas'], { queryParams: { cliente: email } });
  }
}
