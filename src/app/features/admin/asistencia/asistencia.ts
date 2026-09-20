import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subscription, firstValueFrom } from 'rxjs';
import { AttendanceApi } from '../../../core/api/attendance.api';
import { ApiError } from '../../../core/http/api-error';
import { skipErrorToast } from '../../../core/http/error.interceptor';
import { AttendanceRecord } from '../../../core/models';
import { attendanceRows, welcomeMessage } from '../../../core/util/admin-view';
import { Badge } from '../../../shared/ui/badge/badge';
import { EmptyState } from '../../../shared/ui/empty-state/empty-state';
import { Loading } from '../../../shared/ui/loading/loading';
import { PageHeader } from '../../../shared/ui/page-header/page-header';
import { dniNotFound } from '../shared/dni-errors';
import { DniAction, DniPanel } from '../shared/dni-panel';

type HistoryState = 'idle' | 'loading' | 'ready' | 'empty' | 'error';

/**
 * Control de asistencia del admin (recepción): registra el ingreso de un socio o entrenador por
 * su DNI y consulta su historial. El texto de bienvenida del backend viene en inglés: se arma en
 * español con el nombre y el correo que trae.
 */
@Component({
  selector: 'app-admin-asistencia',
  imports: [PageHeader, Badge, EmptyState, Loading, DniPanel],
  host: { class: 'sg-page' },
  templateUrl: './asistencia.html',
  styleUrl: './asistencia.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminAsistencia {
  private readonly attendanceApi = inject(AttendanceApi);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly busy = signal<DniAction | null>(null);
  protected readonly fieldError = signal<string | null>(null);
  protected readonly failure = signal<string | null>(null);
  protected readonly success = signal<string | null>(null);

  protected readonly shownDni = signal<string | null>(null);
  protected readonly historyState = signal<HistoryState>('idle');
  private readonly records = signal<AttendanceRecord[]>([]);
  protected readonly rows = computed(() => attendanceRows(this.records()));

  private request: Subscription | null = null;
  private guard = false;

  protected onEdited(): void {
    this.fieldError.set(null);
    this.failure.set(null);
  }

  protected async onRegister(dni: string): Promise<void> {
    if (this.guard || this.busy()) return;
    this.guard = true;
    this.busy.set('primary');
    this.reset();
    try {
      const message = await firstValueFrom(this.attendanceApi.access(dni));
      this.success.set(welcomeMessage(message));
      this.loadFor(dni, true);
    } catch (err) {
      this.onNotFound(err, dni);
    } finally {
      this.busy.set(null);
      this.guard = false;
    }
  }

  protected onHistory(dni: string): void {
    if (this.busy()) return;
    this.busy.set('secondary');
    this.reset();
    this.loadFor(dni, false);
  }

  protected retry(): void {
    const dni = this.shownDni();
    if (dni) this.loadFor(dni, false);
  }

  private reset(): void {
    this.fieldError.set(null);
    this.failure.set(null);
    this.success.set(null);
  }

  private loadFor(dni: string, silent: boolean): void {
    if (this.shownDni() !== dni) this.records.set([]);
    this.shownDni.set(dni);
    if (!silent) this.historyState.set('loading');
    this.request?.unsubscribe();
    this.request = this.attendanceApi
      .list(dni, skipErrorToast())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (list) => {
          this.records.set(list);
          this.historyState.set(list.length ? 'ready' : 'empty');
          this.busy.set(null);
        },
        error: (err: unknown) => {
          this.busy.set(null);
          this.records.set([]);
          if (err instanceof ApiError && err.isNotFound) {
            this.onNotFound(err, dni);
            return;
          }
          if (err instanceof ApiError && err.status === 403) {
            this.failure.set('No tienes permisos para consultar la asistencia.');
          }
          this.historyState.set('error');
        },
      });
  }

  /** DNI sin vincular (campo) o vínculo sin perfil (aviso); 403, red caída y 5xx ya hacen toast. */
  private onNotFound(err: unknown, dni: string): void {
    if (!(err instanceof ApiError) || !err.isNotFound) return;
    const nf = dniNotFound(err);
    if (nf.target === 'alert') this.failure.set(nf.text);
    else this.fieldError.set(nf.text);
    if (this.shownDni() !== dni || this.historyState() === 'loading') {
      this.records.set([]);
      this.shownDni.set(null);
      this.historyState.set('idle');
    }
  }
}
