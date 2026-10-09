import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { BookingsApi } from '../../../core/api/bookings.api';
import { TrainersApi } from '../../../core/api/trainers.api';
import { AuthService } from '../../../core/auth/auth.service';
import { ApiError } from '../../../core/http/api-error';
import { Booking, Trainer } from '../../../core/models';
import { availableSlots } from '../../../core/util/booking-slots';
import { bookingRows, trainerName } from '../../../core/util/booking-view';
import { todayLabel, toIsoDate, utcOffsetMinutes } from '../../../core/util/dates';
import { NOTE_MAX_LENGTH, applyServerErrors, errorMessage } from '../../../core/util/validators';
import { Badge } from '../../../shared/ui/badge/badge';
import { EmptyState } from '../../../shared/ui/empty-state/empty-state';
import { Loading } from '../../../shared/ui/loading/loading';
import { PageHeader } from '../../../shared/ui/page-header/page-header';
import { ToastService } from '../../../shared/ui/toast/toast.service';

type ListState = 'loading' | 'error' | 'empty' | 'ready';
type SlotsState = 'idle' | 'loading' | 'error' | 'ready';

/** Cada cuánto se refresca "ahora" para que las horas que pasan desaparezcan solas. */
const TICK_MS = 30_000;

/** Reservas: nueva reserva con un entrenador (fecha de hoy la fija el servidor) y "Mis reservas". */
@Component({
  selector: 'app-cliente-reservas',
  imports: [ReactiveFormsModule, PageHeader, Badge, EmptyState, Loading],
  host: { class: 'sg-page' },
  templateUrl: './reservas.html',
  styleUrl: './reservas.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ClienteReservas {
  private readonly trainersApi = inject(TrainersApi);
  private readonly bookingsApi = inject(BookingsApi);
  private readonly auth = inject(AuthService);
  private readonly toasts = inject(ToastService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly fb = inject(FormBuilder).nonNullable;

  protected readonly noteMax = NOTE_MAX_LENGTH;

  protected readonly form = this.fb.group({
    trainer: ['', Validators.required],
    time: ['', Validators.required],
    note: ['', Validators.maxLength(NOTE_MAX_LENGTH)],
  });

  /** Instante de referencia: se refresca cada 30 s y tras cada carga. */
  protected readonly now = signal(new Date());
  protected readonly today = computed(() => todayLabel(this.now()));

  // --- entrenadores
  protected readonly trainersState = signal<ListState>('loading');
  protected readonly trainers = signal<Trainer[]>([]);

  // --- horas ocupadas del entrenador elegido
  protected readonly slotsState = signal<SlotsState>('idle');
  private readonly booked = signal<string[]>([]);
  /** Día local (yyyy-MM-dd) para el que se cargó `booked`; es el que se envía al reservar. */
  private bookedDate = toIsoDate();
  protected readonly slots = computed(() => availableSlots(this.booked(), this.now()));
  protected readonly noSlotsLeft = computed(
    () => this.slotsState() === 'ready' && this.slots().length === 0,
  );

  // --- mis reservas
  protected readonly bookingsState = signal<ListState>('loading');
  private readonly bookings = signal<Booking[]>([]);
  protected readonly rows = computed(() =>
    bookingRows(this.bookings(), this.trainers(), this.now()),
  );

  // --- formulario
  protected readonly selectedTime = signal('');
  protected readonly selectedTrainer = signal('');
  protected readonly noteLength = signal(0);
  protected readonly submitting = signal(false);
  protected readonly failure = signal<string | null>(null);

  constructor() {
    this.loadTrainers();
    this.loadBookings();
    const timer = setInterval(() => this.tick(), TICK_MS);
    this.destroyRef.onDestroy(() => clearInterval(timer));
    this.form.controls.note.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((v) => this.noteLength.set(v.length));
  }

  /** Refresca el reloj; si cruzó la medianoche local, las horas elegidas y ocupadas ya no valen. */
  private tick(): void {
    const now = new Date();
    this.now.set(now);
    if (toIsoDate(now) !== this.bookedDate && this.form.controls.trainer.value) {
      this.pickTime('');
      this.loadAvailability();
    }
  }

  protected error(name: 'trainer' | 'time' | 'note'): string | null {
    const c = this.form.controls[name];
    return c.touched || c.dirty ? errorMessage(c) : null;
  }

  protected loadTrainers(): void {
    this.trainersState.set('loading');
    this.trainersApi
      .list()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (list) => {
          this.trainers.set(list);
          this.trainersState.set(list.length ? 'ready' : 'empty');
          // Si el entrenador elegido ya no existe, se limpia la selección.
          const current = this.form.controls.trainer.value;
          if (current && !list.some((t) => t.email === current)) this.pickTrainer('', false);
        },
        error: () => this.trainersState.set('error'),
      });
  }

  protected loadBookings(): void {
    this.bookingsState.set('loading');
    this.bookingsApi
      .list()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (list) => {
          this.bookings.set(list);
          this.bookingsState.set(list.length ? 'ready' : 'empty');
          this.now.set(new Date());
        },
        error: () => this.bookingsState.set('error'),
      });
  }

  /** Carga las horas ocupadas de hoy del entrenador elegido. */
  protected loadAvailability(): void {
    const email = this.form.controls.trainer.value;
    if (!email) {
      this.slotsState.set('idle');
      this.booked.set([]);
      return;
    }
    this.slotsState.set('loading');
    const requestedAt = new Date();
    const requestedDate = toIsoDate(requestedAt);
    this.trainersApi
      .availability(email, requestedDate)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (a) => {
          // La respuesta de un entrenador anterior no debe pisar la del actual.
          if (this.form.controls.trainer.value !== email) return;
          this.booked.set(a.booked_times);
          this.bookedDate = requestedDate;
          this.now.set(new Date());
          this.slotsState.set('ready');
          const time = this.form.controls.time.value;
          if (time && a.booked_times.some((t) => t.slice(0, 5) === time)) this.pickTime('');
        },
        error: () => {
          if (this.form.controls.trainer.value === email) this.slotsState.set('error');
        },
      });
  }

  /** `clearFailure` es `false` al limpiar la selección por una recarga, para no borrar el aviso del error. */
  protected pickTrainer(email: string, clearFailure = true): void {
    this.form.controls.trainer.setValue(email);
    this.form.controls.trainer.markAsTouched();
    this.selectedTrainer.set(email);
    this.pickTime('');
    if (clearFailure) this.failure.set(null);
    this.loadAvailability();
  }

  protected onTrainerChange(event: Event): void {
    this.pickTrainer((event.target as HTMLSelectElement).value);
  }

  protected pickTime(time: string): void {
    const control = this.form.controls.time;
    control.setValue(time);
    this.selectedTime.set(time);
    if (time) {
      control.markAsTouched();
    } else {
      // Limpiar la hora (por un 409/422 o al cambiar de entrenador) no debe mostrar "obligatorio".
      control.markAsUntouched();
      control.markAsPristine();
    }
  }

  protected submit(): void {
    if (this.submitting()) return;
    this.form.markAllAsTouched();
    const email = this.auth.email();
    if (this.form.invalid || !email) return;

    const at = new Date(); // fecha y desfase salen del mismo instante
    if (toIsoDate(at) !== this.bookedDate) {
      // Cruzó la medianoche local: las horas mostradas son de ayer.
      this.now.set(at);
      this.pickTime('');
      this.failure.set('Cambió el día. Elige de nuevo la hora.');
      this.loadAvailability();
      return;
    }
    const { trainer, time, note } = this.form.getRawValue();
    const trainerLabel = trainerName(this.trainers(), trainer);
    this.submitting.set(true);
    this.failure.set(null);
    this.bookingsApi
      .create({
        customer_email: email,
        trainer_email: trainer,
        date: this.bookedDate,
        utcOffsetMinutes: utcOffsetMinutes(at),
        time,
        ...(note.trim() ? { note: note.trim() } : {}),
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.submitting.set(false);
          this.toasts.success(
            `Tu reserva de hoy a las ${time} con ${trainerLabel} quedó registrada.`,
            'Reserva creada',
          );
          this.pickTime('');
          this.form.controls.note.reset('');
          this.loadAvailability();
          this.loadBookings();
        },
        error: (err: unknown) => {
          this.submitting.set(false);
          if (!(err instanceof ApiError)) return;
          if (err.status === 409 || err.status === 422) {
            // El aviso ya lo muestra el interceptor; se refrescan las horas para ver el estado real.
            this.pickTime('');
            this.loadAvailability();
          } else if (err.status === 400) {
            const unmatched = applyServerErrors(this.form, err);
            if (unmatched.length) this.failure.set(err.message);
          } else if (err.isNotFound) {
            this.failure.set(err.message);
            this.loadTrainers();
          }
        },
      });
  }
}
