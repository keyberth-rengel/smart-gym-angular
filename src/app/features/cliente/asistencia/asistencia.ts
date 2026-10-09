import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AttendanceApi } from '../../../core/api/attendance.api';
import { AuthService } from '../../../core/auth/auth.service';
import { ApiError } from '../../../core/http/api-error';
import { AttendanceRecord } from '../../../core/models';
import { formatDayMonth, formatTime, formatYear, toTimestamp } from '../../../core/util/dates';
import { Badge } from '../../../shared/ui/badge/badge';
import { EmptyState } from '../../../shared/ui/empty-state/empty-state';
import { Loading } from '../../../shared/ui/loading/loading';
import { PageHeader } from '../../../shared/ui/page-header/page-header';

type ViewState = 'loading' | 'error' | 'empty' | 'ready';

/** Asistencia: registra el ingreso del cliente y muestra su historial. */
@Component({
  selector: 'app-cliente-asistencia',
  imports: [PageHeader, Badge, EmptyState, Loading],
  host: { class: 'sg-page' },
  templateUrl: './asistencia.html',
  styleUrl: './asistencia.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ClienteAsistencia {
  private readonly api = inject(AttendanceApi);
  protected readonly auth = inject(AuthService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly state = signal<ViewState>('loading');
  private readonly records = signal<AttendanceRecord[]>([]);

  /** `true` mientras se envía el ingreso: evita el doble envío. */
  protected readonly submitting = signal(false);
  protected readonly success = signal<string | null>(null);
  protected readonly failure = signal<string | null>(null);

  protected readonly count = computed(() => this.records().length);
  protected readonly countLabel = computed(
    () => `${this.count()} ${this.count() === 1 ? 'ingreso' : 'ingresos'}`,
  );

  /** Más reciente primero; la numeración cuenta desde el primer ingreso. */
  protected readonly rows = computed(() => {
    const sorted = [...this.records()].sort(
      (a, b) => toTimestamp(a.timestamp) - toTimestamp(b.timestamp),
    );
    return sorted
      .map((r, i) => ({
        key: r.id,
        n: i + 1,
        day: formatDayMonth(r.timestamp),
        year: formatYear(r.timestamp),
        time: formatTime(r.timestamp),
      }))
      .reverse();
  });

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
        next: (records) => {
          this.records.set(records);
          this.state.set(records.length ? 'ready' : 'empty');
        },
        error: (err: unknown) => {
          this.records.set([]);
          this.state.set(err instanceof ApiError && err.isNotFound ? 'empty' : 'error');
        },
      });
  }

  protected markAttendance(): void {
    const dni = this.auth.dni();
    if (this.submitting() || !dni) return;
    this.submitting.set(true);
    this.success.set(null);
    this.failure.set(null);
    this.api
      .access(dni)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.submitting.set(false);
          const name = this.auth.fullName() ?? '';
          this.success.set(
            `¡Bienvenido ${name}! Ingreso registrado hoy a las ${formatTime(new Date())}.`,
          );
          this.load(true);
        },
        error: (err: unknown) => {
          this.submitting.set(false);
          // 5xx, red y 422 con aviso ya los muestra el interceptor; aquí solo el "no vinculado".
          if (err instanceof ApiError && err.isNotFound) {
            this.failure.set('Este DNI no está vinculado a ninguna cuenta de SmartGym.');
          }
        },
      });
  }
}
