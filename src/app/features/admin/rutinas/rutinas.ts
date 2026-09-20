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
import { CustomersApi } from '../../../core/api/customers.api';
import { IdentityApi } from '../../../core/api/identity.api';
import { RoutinesApi } from '../../../core/api/routines.api';
import { ApiError } from '../../../core/http/api-error';
import { skipErrorToast } from '../../../core/http/error.interceptor';
import { Identity, RoutineHistoryItem } from '../../../core/models';
import { formatDate } from '../../../core/util/dates';
import { activePlan, historyEntries } from '../../cliente/rutina/routine-view';
import { Badge } from '../../../shared/ui/badge/badge';
import { ConfirmService } from '../../../shared/ui/confirm/confirm.service';
import { EmptyState } from '../../../shared/ui/empty-state/empty-state';
import { Loading } from '../../../shared/ui/loading/loading';
import { PageHeader } from '../../../shared/ui/page-header/page-header';
import { PlanGrid } from '../../../shared/ui/plan-grid/plan-grid';
import { RoutineHistory } from '../../../shared/ui/routine-history/routine-history';
import { ToastService } from '../../../shared/ui/toast/toast.service';
import { DniAction, DniPanel } from '../shared/dni-panel';
import { NOT_A_CUSTOMER_MESSAGE, dniNotFound } from '../shared/dni-errors';

type HistoryState = 'idle' | 'loading' | 'ready' | 'empty' | 'error';

/**
 * Rutinas del admin: por DNI asigna un plan semanal o consulta el historial. Mientras se
 * consulta un DNI, el resultado (rutina activa e historial) queda visible; un DNI no vinculado se
 * marca en el campo y limpia el resultado anterior (lo mostrado siempre es del DNI consultado).
 */
@Component({
  selector: 'app-admin-rutinas',
  imports: [PageHeader, Badge, EmptyState, Loading, PlanGrid, RoutineHistory, DniPanel],
  host: { class: 'sg-page' },
  templateUrl: './rutinas.html',
  styleUrl: './rutinas.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminRutinas {
  private readonly routinesApi = inject(RoutinesApi);
  private readonly identityApi = inject(IdentityApi);
  private readonly customersApi = inject(CustomersApi);
  private readonly confirm = inject(ConfirmService);
  private readonly toasts = inject(ToastService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly busy = signal<DniAction | null>(null);
  protected readonly fieldError = signal<string | null>(null);
  protected readonly failure = signal<string | null>(null);

  /** DNI cuyo resultado se muestra. */
  protected readonly shownDni = signal<string | null>(null);
  protected readonly historyState = signal<HistoryState>('idle');
  private readonly history = signal<RoutineHistoryItem[]>([]);
  private readonly identity = signal<Identity | null>(null);
  /** DNI al que se acaba de asignar una rutina en esta pantalla. */
  private readonly assignedDni = signal<string | null>(null);

  protected readonly email = computed(() => {
    const id = this.identity();
    return id && id.dni === this.shownDni() ? id.email : null;
  });
  protected readonly plan = computed(() => activePlan(this.history()));
  protected readonly hasActive = computed(() => this.history().length > 0);
  protected readonly activeSince = computed(() => {
    const h = this.history();
    return h.length ? formatDate(h[h.length - 1].created_at) : null;
  });
  protected readonly entries = computed(() =>
    historyEntries(this.history()).map((e) => ({ ...e, date: formatDate(e.createdAt) })),
  );
  protected readonly justAssigned = computed(
    () => this.assignedDni() !== null && this.assignedDni() === this.shownDni(),
  );
  protected readonly successMessage = computed(() =>
    this.justAssigned() ? `Rutina asignada a ${this.email() ?? `DNI ${this.shownDni()}`}.` : null,
  );
  protected readonly subject = computed(() => this.email() ?? `DNI ${this.shownDni()}`);

  private request: Subscription | null = null;
  private guard = false;

  /** El usuario editó el DNI: se limpian los avisos de la consulta anterior. */
  protected onEdited(): void {
    this.fieldError.set(null);
    this.failure.set(null);
  }

  protected onHistory(dni: string): void {
    if (this.busy()) return;
    this.busy.set('secondary');
    this.fieldError.set(null);
    this.failure.set(null);
    this.assignedDni.set(null);
    this.loadFor(dni, false);
  }

  protected retry(): void {
    const dni = this.shownDni();
    if (dni) this.loadFor(dni, false);
  }

  protected async onAssign(dni: string): Promise<void> {
    if (this.guard || this.busy()) return;
    this.guard = true;
    this.fieldError.set(null);
    this.failure.set(null);
    try {
      if (this.shownDni() === dni && this.hasActive()) {
        const ok = await this.confirm.confirm({
          title: '¿Asignar una nueva rutina?',
          message: `Se reemplazará la rutina activa de ${this.subject()}. La actual pasará al historial.`,
          confirmLabel: 'Asignar rutina',
        });
        if (!ok) return;
      }
      this.busy.set('primary');
      await firstValueFrom(this.routinesApi.assign(dni));
      this.toasts.success('La nueva rutina semanal ya está activa.', 'Rutina asignada');
      this.assignedDni.set(dni);
      this.loadFor(dni, true);
    } catch (err) {
      this.onError(err, dni);
    } finally {
      this.busy.set(null);
      this.guard = false;
    }
  }

  private loadFor(dni: string, silent: boolean): void {
    if (this.shownDni() !== dni) {
      this.history.set([]);
      this.identity.set(null);
    }
    this.shownDni.set(dni);
    if (!silent) this.historyState.set('loading');
    this.request?.unsubscribe();
    this.request = this.routinesApi
      .history(dni, skipErrorToast())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (h) => {
          this.history.set(h);
          this.historyState.set(h.length ? 'ready' : 'empty');
          this.busy.set(null);
          this.resolveEmail(dni);
          if (!h.length) this.verifyCustomer(dni);
        },
        error: (err: unknown) => {
          this.busy.set(null);
          this.onHistoryError(err, dni);
        },
      });
  }

  /** El correo solo adorna el aviso: si no se puede resolver se muestra el DNI. */
  private resolveEmail(dni: string): void {
    if (this.identity()?.dni === dni) return;
    this.identityApi
      .resolve(dni, skipErrorToast())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({ next: (id) => this.identity.set(id), error: () => undefined });
  }

  /**
   * El backend responde 200 con lista vacía también para el DNI de un entrenador: si no hay rutinas
   * se confirma que el DNI sea de un cliente para no decir "este cliente aún no tiene rutinas" de quien no lo es.
   */
  private verifyCustomer(dni: string): void {
    this.customersApi
      .getByDni(dni, skipErrorToast())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => undefined,
        error: (err: unknown) => {
          if (!(err instanceof ApiError) || !err.isNotFound || this.shownDni() !== dni) return;
          this.failure.set(NOT_A_CUSTOMER_MESSAGE);
          this.clearResult();
        },
      });
  }

  private onHistoryError(err: unknown, dni: string): void {
    if (err instanceof ApiError && err.isNotFound) {
      // el resultado en pantalla siempre corresponde al DNI consultado: si no existe, se limpia
      this.showNotFound(err);
      this.clearResult();
      return;
    }
    if (err instanceof ApiError && err.status === 403) {
      this.failure.set('No tienes permisos para consultar las rutinas.');
    }
    this.history.set([]);
    this.shownDni.set(dni);
    this.historyState.set('error');
  }

  private onError(err: unknown, dni: string): void {
    // 403, red caída y 5xx ya muestran su toast (interceptor)
    if (!(err instanceof ApiError) || !err.isNotFound) return;
    this.showNotFound(err);
    if (this.shownDni() !== dni) this.clearResult();
  }

  private clearResult(): void {
    this.history.set([]);
    this.shownDni.set(null);
    this.historyState.set('idle');
  }

  private showNotFound(err: ApiError): void {
    const nf = dniNotFound(err);
    if (nf.target === 'alert') this.failure.set(nf.text);
    else this.fieldError.set(nf.text);
  }
}
