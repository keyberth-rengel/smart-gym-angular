import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ProgressApi } from '../../../core/api/progress.api';
import { AuthService } from '../../../core/auth/auth.service';
import { ApiError } from '../../../core/http/api-error';
import { ProgressList } from '../../../core/models';
import { formatDayMonth, formatYear } from '../../../core/util/dates';
import { EmptyState } from '../../../shared/ui/empty-state/empty-state';
import { Loading } from '../../../shared/ui/loading/loading';
import { PageHeader } from '../../../shared/ui/page-header/page-header';
import { Sparkline } from '../../../shared/ui/sparkline/sparkline';
import { ProgressDialog } from './progress-dialog';
import { averagesText, buildMetrics, fmt, sortAscending } from './progress-stats';

type ViewState = 'loading' | 'error' | 'empty' | 'ready';

/** Mi Progreso: últimas métricas con su evolución, historial y registro del día. */
@Component({
  selector: 'app-cliente-progreso',
  imports: [PageHeader, EmptyState, Loading, Sparkline, ProgressDialog],
  host: { class: 'sg-page' },
  templateUrl: './progreso.html',
  styleUrl: './progreso.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ClienteProgreso {
  private readonly api = inject(ProgressApi);
  private readonly auth = inject(AuthService);
  private readonly destroyRef = inject(DestroyRef);

  private readonly dialog = viewChild.required(ProgressDialog);

  protected readonly state = signal<ViewState>('loading');
  private readonly data = signal<ProgressList | null>(null);

  protected readonly metrics = computed(() => buildMetrics(this.data()?.items ?? []));
  protected readonly averages = computed(() => {
    const d = this.data();
    return d ? averagesText(d.total, d.avg_weight_kg, d.avg_body_fat_pct, d.avg_muscle_pct) : null;
  });

  /** Filas del historial, la más reciente primero. */
  protected readonly rows = computed(() =>
    sortAscending(this.data()?.items ?? [])
      .reverse()
      .map((i) => ({
        key: i.date,
        day: formatDayMonth(i.date),
        year: formatYear(i.date),
        weight: fmt(i.weight_kg),
        fat: fmt(i.body_fat_pct),
        muscle: fmt(i.muscle_pct),
      })),
  );

  constructor() {
    this.load();
  }

  protected load(silent = false): void {
    const dni = this.auth.dni();
    if (!dni) {
      this.state.set('error');
      return;
    }
    if (!silent) this.state.set('loading');
    this.api
      .list(dni)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (data) => {
          this.data.set(data);
          this.state.set(data.items.length ? 'ready' : 'empty');
        },
        error: (err: unknown) => {
          this.data.set(null);
          this.state.set(err instanceof ApiError && err.isNotFound ? 'empty' : 'error');
        },
      });
  }

  protected openDialog(): void {
    this.dialog().open();
  }
}
