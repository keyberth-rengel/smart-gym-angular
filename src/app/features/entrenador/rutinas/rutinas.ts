import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  Injector,
  afterNextRender,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { Subscription, firstValueFrom } from 'rxjs';
import { RoutinesApi } from '../../../core/api/routines.api';
import { TrainersApi } from '../../../core/api/trainers.api';
import { AuthService } from '../../../core/auth/auth.service';
import { ApiError } from '../../../core/http/api-error';
import { notify, skipErrorToast } from '../../../core/http/error.interceptor';
import { RoutineHistoryItem, TrainerCustomer } from '../../../core/models';
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

type ListState = 'loading' | 'error' | 'empty' | 'ready';
type HistoryState = 'idle' | 'loading' | 'ready' | 'empty' | 'forbidden' | 'error';

/** Rutinas del entrenador: elegir un cliente, ver su rutina activa e historial y asignar una nueva. */
@Component({
  selector: 'app-entrenador-rutinas',
  imports: [PageHeader, Badge, EmptyState, Loading, PlanGrid, RoutineHistory],
  host: { class: 'sg-page' },
  templateUrl: './rutinas.html',
  styleUrl: './rutinas.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EntrenadorRutinas {
  private readonly auth = inject(AuthService);
  private readonly trainersApi = inject(TrainersApi);
  private readonly routinesApi = inject(RoutinesApi);
  private readonly confirm = inject(ConfirmService);
  private readonly toasts = inject(ToastService);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  private readonly injector = inject(Injector);

  protected readonly state = signal<ListState>('loading');
  protected readonly customers = signal<TrainerCustomer[]>([]);
  protected readonly selectedEmail = signal<string | null>(null);
  protected readonly selected = computed(
    () => this.customers().find((c) => c.email === this.selectedEmail()) ?? null,
  );

  protected readonly historyState = signal<HistoryState>('idle');
  private readonly history = signal<RoutineHistoryItem[]>([]);
  private historyRequest: Subscription | null = null;

  protected readonly plan = computed(() => activePlan(this.history()));
  protected readonly hasActive = computed(() => this.history().length > 0);
  protected readonly activeSince = computed(() => {
    const h = this.history();
    return h.length ? formatDate(h[h.length - 1].created_at) : null;
  });
  protected readonly entries = computed(() =>
    historyEntries(this.history()).map((e) => ({ ...e, date: formatDate(e.createdAt) })),
  );

  /** `true` desde que se pulsa "Asignar" (incluida la confirmación): evita el doble envío. */
  private readonly submitting = signal(false);
  /** `true` solo mientras viaja la petición: deshabilita el botón. Durante la confirmación el
   * botón sigue habilitado para que el diálogo devuelva el foco a un control activo. */
  protected readonly sending = signal(false);
  private readonly assignButton = viewChild<ElementRef<HTMLButtonElement>>('assignButton');
  protected readonly success = signal<string | null>(null);
  protected readonly failure = signal<string | null>(null);

  constructor() {
    this.loadCustomers();
  }

  protected loadCustomers(): void {
    const email = this.auth.email();
    if (!email) return;
    this.state.set('loading');
    this.trainersApi
      .customers(email)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (list) => {
          this.customers.set(list);
          this.state.set(list.length ? 'ready' : 'empty');
          // "?cliente=<correo>" (viene de Mis clientes) preselecciona; si no es suyo, se ignora.
          const wanted = this.route.snapshot.queryParamMap.get('cliente')?.toLowerCase();
          const match = list.find((c) => c.email.toLowerCase() === wanted);
          if (match) this.choose(match.email);
        },
        error: () => {
          this.customers.set([]);
          this.state.set('error');
        },
      });
  }

  protected onSelect(email: string): void {
    this.choose(email || null);
  }

  private choose(email: string | null): void {
    this.selectedEmail.set(email);
    this.success.set(null);
    this.failure.set(null);
    this.history.set([]);
    if (email) this.loadHistory();
    else {
      this.historyRequest?.unsubscribe();
      this.historyState.set('idle');
    }
  }

  protected loadHistory(silent = false): void {
    const email = this.selectedEmail();
    if (!email) return;
    if (!silent) this.historyState.set('loading');
    this.historyRequest?.unsubscribe();
    this.historyRequest = this.routinesApi
      .historyByEmail(email, skipErrorToast())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (h) => {
          this.history.set(h);
          this.historyState.set(h.length ? 'ready' : 'empty');
        },
        error: (err: unknown) => {
          this.history.set([]);
          this.historyState.set(
            err instanceof ApiError && err.status === 403
              ? 'forbidden'
              : err instanceof ApiError && err.isNotFound
                ? 'empty'
                : 'error',
          );
        },
      });
  }

  protected async assign(): Promise<void> {
    const customer = this.selected();
    if (!customer || this.submitting()) return;
    this.submitting.set(true);
    this.success.set(null);
    this.failure.set(null);
    let sent = false;
    try {
      if (this.hasActive()) {
        const ok = await this.confirm.confirm({
          title: '¿Asignar una nueva rutina?',
          message: `Se reemplazará la rutina activa de ${customer.name}. La actual pasará al historial.`,
          confirmLabel: 'Asignar rutina',
        });
        if (!ok) return;
      }
      this.sending.set(true);
      sent = true;
      await firstValueFrom(this.routinesApi.assignByEmail(customer.email, skipErrorToast()));
      this.toasts.success(`Le asignaste una nueva rutina a ${customer.name}.`, 'Rutina asignada');
      this.success.set(`Rutina asignada el ${formatDate(new Date())}.`);
      this.loadHistory(true);
    } catch (err) {
      this.onAssignError(err);
    } finally {
      this.sending.set(false);
      this.submitting.set(false);
      // Solo si el botón llegó a deshabilitarse: al cancelar la confirmación el diálogo ya devuelve el foco.
      if (sent) this.restoreFocus();
    }
  }

  /** El botón se deshabilita durante el envío y el navegador suelta el foco: se devuelve al terminar. */
  private restoreFocus(): void {
    afterNextRender(
      () => {
        const active = document.activeElement;
        if (!active || active === document.body) this.assignButton()?.nativeElement.focus();
      },
      { injector: this.injector },
    );
  }

  private onAssignError(err: unknown): void {
    if (!(err instanceof ApiError)) return;
    if (err.status === 403) {
      this.failure.set(
        'No puedes asignar rutinas a este cliente: solo a quienes han reservado contigo.',
      );
    } else if (err.isNotFound) {
      this.failure.set('No encontramos a este cliente. Actualiza la lista e inténtalo de nuevo.');
    } else if (err.status === 400) {
      this.failure.set('La solicitud no es válida. Elige un cliente e inténtalo de nuevo.');
    } else {
      notify(this.toasts, err);
    }
  }
}
