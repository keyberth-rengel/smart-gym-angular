import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RoutinesApi } from '../../../core/api/routines.api';
import { AuthService } from '../../../core/auth/auth.service';
import { ApiError } from '../../../core/http/api-error';
import { RoutineHistoryItem, WeekdayKey } from '../../../core/models';
import { formatDate } from '../../../core/util/dates';
import { blockLabel, hasRoutineFor, todayKey, weekdayInfo } from '../../../core/util/routine-blocks';
import { Badge } from '../../../shared/ui/badge/badge';
import { DayPills } from '../../../shared/ui/day-pills/day-pills';
import { EmptyState } from '../../../shared/ui/empty-state/empty-state';
import { Loading } from '../../../shared/ui/loading/loading';
import { PageHeader } from '../../../shared/ui/page-header/page-header';
import { RoutineHistory } from '../../../shared/ui/routine-history/routine-history';
import { activePlan, historyEntries } from './routine-view';

type ViewState = 'loading' | 'error' | 'empty' | 'ready';

/** Mi Rutina: plan semanal activo por día e historial de rutinas asignadas. */
@Component({
  selector: 'app-cliente-rutina',
  imports: [PageHeader, Badge, DayPills, EmptyState, Loading, RoutineHistory],
  host: { class: 'sg-page' },
  templateUrl: './rutina.html',
  styleUrl: './rutina.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ClienteRutina {
  private readonly api = inject(RoutinesApi);
  private readonly auth = inject(AuthService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly state = signal<ViewState>('loading');
  private readonly history = signal<RoutineHistoryItem[]>([]);
  protected readonly selected = signal<WeekdayKey | null>(todayKey());

  protected readonly plan = computed(() => activePlan(this.history()));
  protected readonly entries = computed(() =>
    historyEntries(this.history()).map((e) => ({ ...e, date: formatDate(e.createdAt) })),
  );

  /** Datos de la tarjeta del día seleccionado. */
  protected readonly day = computed(() => {
    const key = this.selected() ?? todayKey();
    const info = weekdayInfo(key);
    const rest = !hasRoutineFor(key);
    return {
      long: info.long,
      block: rest ? blockLabel(null) : blockLabel(this.plan()?.[key]),
      rest,
      isToday: key === todayKey(),
    };
  });

  constructor() {
    this.load();
  }

  protected load(): void {
    const dni = this.auth.dni();
    if (!dni) {
      this.state.set('error');
      return;
    }
    this.state.set('loading');
    this.api
      .history(dni)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (history) => {
          this.history.set(history);
          this.state.set(history.length ? 'ready' : 'empty');
        },
        error: (err: unknown) => {
          // Sin datos (el backend responde 422 en vez de 404) se ve como "sin rutina".
          this.history.set([]);
          this.state.set(err instanceof ApiError && err.isNotFound ? 'empty' : 'error');
        },
      });
  }
}
