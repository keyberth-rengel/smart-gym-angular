import { Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { Observable, forkJoin, map, of, switchMap, tap } from 'rxjs';
import { BookingsApi } from '../../../core/api/bookings.api';
import { CustomersApi } from '../../../core/api/customers.api';
import { HealthApi } from '../../../core/api/health.api';
import { TrainersApi } from '../../../core/api/trainers.api';
import { ApiError } from '../../../core/http/api-error';
import { Booking } from '../../../core/models';
import { applyServerErrors, errorMessage } from '../../../core/util/validators';
import { ToastKind, ToastService } from '../../../shared/ui/toast/toast.service';

interface Seed {
  customer: string;
  trainer: string;
}

/** Vista temporal (F1) para probar a mano el cliente API, los errores y los toasts. Se elimina en F2. */
@Component({
  selector: 'app-api-playground',
  imports: [ReactiveFormsModule],
  templateUrl: './api-playground.html',
  styleUrl: './api-playground.scss',
})
export class ApiPlayground {
  private readonly health = inject(HealthApi);
  private readonly customers = inject(CustomersApi);
  private readonly trainers = inject(TrainersApi);
  private readonly bookings = inject(BookingsApi);
  private readonly toast = inject(ToastService);

  protected readonly result = signal('');
  protected readonly busy = signal(false);
  protected readonly toastKinds: ToastKind[] = ['success', 'error', 'warning', 'info'];

  protected readonly form = new FormGroup({
    email: new FormControl('nope', { nonNullable: true }),
    name: new FormControl('', { nonNullable: true }),
    age: new FormControl('-1', { nonNullable: true }),
  });

  private seed: Seed | null = null;
  private lastCustomer: string | null = null;
  private lastBooking: Booking | null = null;

  protected checkHealth(): void {
    this.run(this.health.check());
  }

  protected createCustomer(): void {
    this.run(this.newCustomer());
  }

  /** Crea un cliente y vuelve a crearlo: el backend responde 409. */
  protected createCustomerTwice(): void {
    const email = this.lastCustomer ?? this.uniqueEmail('dup');
    const first: Observable<unknown> = this.lastCustomer
      ? of(null)
      : this.customers.create(this.payload(email));
    this.run(
      first.pipe(
        tap(() => (this.lastCustomer = email)),
        switchMap(() => this.customers.create(this.payload(email))),
      ),
    );
  }

  protected getMissingCustomer(): void {
    this.run(this.customers.getByEmail('no-existe@example.com'));
  }

  protected submitInvalid(): void {
    const raw = this.form.getRawValue();
    this.form.markAsPristine();
    this.run(
      this.customers.create({ email: raw.email, name: raw.name, age: Number(raw.age) }),
      (err) => applyServerErrors(this.form, err),
    );
  }

  protected bookingPast(): void {
    this.run(
      this.ensureSeed().pipe(
        switchMap((s) =>
          this.bookings.create({
            customer_email: s.customer,
            trainer_email: s.trainer,
            time: '00:00',
          }),
        ),
      ),
    );
  }

  protected bookingOk(): void {
    this.run(this.newBooking());
  }

  /** Crea una reserva y la repite en la misma hora: el backend responde 409. */
  protected bookingDuplicate(): void {
    this.run(
      this.ensureBooking().pipe(
        switchMap((b) =>
          this.bookings.create({
            customer_email: b.customer_email,
            trainer_email: b.trainer_email,
            time: b.time,
          }),
        ),
      ),
    );
  }

  protected cancelBooking(): void {
    this.run(
      this.ensureBooking().pipe(
        switchMap((b) =>
          this.bookings.cancel(b.id).pipe(map(() => ({ canceled: b.id, body: null }))),
        ),
        tap(() => (this.lastBooking = null)),
      ),
    );
  }

  protected fireToast(kind: ToastKind): void {
    const messages: Record<ToastKind, string> = {
      success: 'Tu reserva de hoy quedó registrada.',
      error: 'Ese horario ya está ocupado para este entrenador. Elige otra hora.',
      warning: 'No se pueden crear reservas en horas que ya pasaron.',
      info: 'Tu rutina cambia a partir del lunes.',
    };
    this.toast[kind](messages[kind]);
  }

  protected fireManyToasts(): void {
    for (let i = 1; i <= 6; i++) this.toast.info(`Notificación ${i}`, `Toast ${i}`);
  }

  protected showError(name: 'email' | 'name' | 'age'): string | null {
    const control = this.form.controls[name];
    return control.touched ? errorMessage(control) : null;
  }

  // ---- ayudas ----

  private payload(email: string) {
    return { email, name: 'Cliente de prueba', age: 30 };
  }

  private uniqueEmail(prefix: string): string {
    return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1000)}@example.com`;
  }

  private newCustomer() {
    const email = this.uniqueEmail('cliente');
    return this.customers.create(this.payload(email)).pipe(tap(() => (this.lastCustomer = email)));
  }

  private ensureSeed(): Observable<Seed> {
    if (this.seed) return of(this.seed);
    const customer = this.uniqueEmail('seed-cliente');
    const trainer = this.uniqueEmail('seed-entrenador');
    return forkJoin([
      this.customers.create(this.payload(customer)),
      this.trainers.create({
        email: trainer,
        name: 'Entrenador de prueba',
        age: 33,
        specialty: 'Fuerza',
      }),
    ]).pipe(map(() => (this.seed = { customer, trainer })));
  }

  /** Hora aleatoria entre ahora+1 min y 23:59, para no chocar con reservas previas ni con el pasado. */
  private futureTime(): string {
    const now = new Date();
    const current = now.getHours() * 60 + now.getMinutes();
    const span = 1439 - current;
    const minutes = span > 0 ? current + 1 + Math.floor(Math.random() * span) : 1439;
    const h = String(Math.floor(minutes / 60)).padStart(2, '0');
    const m = String(minutes % 60).padStart(2, '0');
    return `${h}:${m}`;
  }

  private newBooking(): Observable<Booking> {
    return this.ensureSeed().pipe(
      switchMap((s) =>
        this.bookings.create({
          customer_email: s.customer,
          trainer_email: s.trainer,
          time: this.futureTime(),
          note: 'Reserva de prueba',
        }),
      ),
      tap((b) => (this.lastBooking = b)),
    );
  }

  private ensureBooking(): Observable<Booking> {
    return this.lastBooking ? of(this.lastBooking) : this.newBooking();
  }

  private run<T>(obs: Observable<T>, onError?: (err: ApiError) => void): void {
    this.busy.set(true);
    obs.subscribe({
      next: (data) => {
        this.busy.set(false);
        this.result.set(JSON.stringify({ ok: true, data: data ?? null }, null, 2));
      },
      error: (err: unknown) => {
        this.busy.set(false);
        if (err instanceof ApiError) {
          onError?.(err);
          this.result.set(
            JSON.stringify(
              {
                ok: false,
                status: err.status,
                code: err.code,
                message: err.message,
                rawMessage: err.rawMessage,
                isNotFound: err.isNotFound,
                fieldErrors: err.fieldErrors,
              },
              null,
              2,
            ),
          );
        } else {
          this.result.set(JSON.stringify({ ok: false, unexpected: String(err) }, null, 2));
        }
      },
    });
  }
}
