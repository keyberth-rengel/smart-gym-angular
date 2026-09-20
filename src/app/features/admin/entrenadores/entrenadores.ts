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
import { TrainersApi } from '../../../core/api/trainers.api';
import { ApiError } from '../../../core/http/api-error';
import { notify, skipErrorToast } from '../../../core/http/error.interceptor';
import { Invitation, Trainer } from '../../../core/models';
import { ADMIN_MAX_AGE, InvitationOutcome, invitationOutcome } from '../../../core/util/admin-view';
import {
  applyServerErrors,
  dniValidator,
  errorMessage,
  integerValidator,
  noAngleBracketsValidator,
} from '../../../core/util/validators';
import { PageHeader } from '../../../shared/ui/page-header/page-header';
import { ToastService } from '../../../shared/ui/toast/toast.service';
import { RegistryColumn, RegistryList, RegistryRow, RegistryStatus } from '../shared/registry-list';

type Field = 'name' | 'email' | 'specialty' | 'age' | 'dni';

/** Entrenadores (admin): registrar e invitar por Clerk, consultar el equipo y reenviar invitaciones. */
@Component({
  selector: 'app-admin-entrenadores',
  imports: [ReactiveFormsModule, PageHeader, RegistryList],
  host: { class: 'sg-page' },
  templateUrl: './entrenadores.html',
  styleUrl: './entrenadores.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminEntrenadores {
  private readonly api = inject(TrainersApi);
  private readonly toast = inject(ToastService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly status = signal<RegistryStatus>('loading');
  /** La lista falló con un 403 (la cuenta no es admin). */
  protected readonly forbidden = signal(false);
  protected readonly trainers = signal<Trainer[]>([]);
  protected readonly rows = computed(() => this.trainers().map((t) => ({ ...t })));
  protected readonly columns: readonly RegistryColumn[] = [
    { key: 'name', label: 'Nombre' },
    { key: 'email', label: 'Correo', muted: true, hideBelowLg: true },
    { key: 'specialty', label: 'Especialidad' },
    { key: 'age', label: 'Edad', end: true },
  ];
  protected readonly inviteLabel = (row: RegistryRow) => `Reenviar invitación a ${row.name}`;

  protected readonly submitting = signal(false);
  /** Resultado de la última alta cuando la invitación no salió (aviso persistente ámbar/rojo). */
  protected readonly notice = signal<InvitationOutcome | null>(null);
  /** Correos con un reenvío en curso: sin doble envío por fila. */
  protected readonly pending = signal<string[]>([]);

  protected readonly form = inject(FormBuilder).nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(120), noAngleBracketsValidator]],
    email: ['', [Validators.required, Validators.email]],
    specialty: ['', [Validators.maxLength(80)]],
    age: [
      '',
      [Validators.required, integerValidator, Validators.min(0), Validators.max(ADMIN_MAX_AGE)],
    ],
    dni: ['', [dniValidator]],
  });

  constructor() {
    this.load();
  }

  protected load(): void {
    this.status.set('loading');
    this.forbidden.set(false);
    this.api
      .list()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (list) => {
          this.trainers.set(list);
          this.status.set('ready');
        },
        error: (err: unknown) => {
          this.forbidden.set(err instanceof ApiError && err.status === 403);
          this.status.set('error');
        },
      });
  }

  /** Mensaje de error del campo, solo tras tocarlo o intentar enviar. */
  protected error(name: Field): string | null {
    const control = this.form.controls[name];
    return control.touched || control.dirty ? errorMessage(control) : null;
  }

  protected submit(): void {
    if (this.submitting()) return;
    this.form.markAllAsTouched();
    if (this.form.invalid) return;

    const { name, email, specialty, age, dni } = this.form.getRawValue();
    const body = {
      name: name.trim(),
      email: email.trim(),
      age: Number(age),
      ...(specialty.trim() ? { specialty: specialty.trim() } : {}),
      ...(dni.trim() ? { dni: dni.trim() } : {}),
    };
    this.submitting.set(true);
    this.notice.set(null);
    this.api
      .create(body, skipErrorToast())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (created) => {
          this.submitting.set(false);
          this.showInvitation(created.invitation, body.email, true);
          this.form.reset();
          this.load();
        },
        error: (err: unknown) => {
          this.submitting.set(false);
          if (err instanceof ApiError) this.handleError(err);
        },
      });
  }

  protected resend(row: RegistryRow): void {
    if (this.pending().includes(row.email)) return;
    this.pending.update((p) => [...p, row.email]);
    this.api
      .invite(row.email, skipErrorToast())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (invitation) => {
          this.unmark(row.email);
          this.showInvitation(invitation, row.email, false);
        },
        error: (err: unknown) => {
          this.unmark(row.email);
          if (!(err instanceof ApiError)) return;
          if (err.isNotFound) {
            this.toast.warning('El entrenador ya no existe.', 'No se pudo reenviar');
            this.load();
            return;
          }
          notify(this.toast, err);
        },
      });
  }

  private unmark(email: string): void {
    this.pending.update((p) => p.filter((e) => e !== email));
  }

  /** Éxito => toast; invitación omitida o fallida => aviso persistente en el formulario (o toast al reenviar). */
  private showInvitation(invitation: Invitation, email: string, created: boolean): void {
    const outcome = invitationOutcome(invitation, email, created);
    if (outcome.tone === 'success') {
      this.toast.success(outcome.text);
    } else if (created) {
      this.notice.set(outcome);
    } else if (outcome.tone === 'warning') {
      this.toast.warning(outcome.text, 'Invitación');
    } else {
      this.toast.error(outcome.text, 'Invitación');
    }
  }

  /** 400 y 409 se muestran junto al campo; red caída, 5xx y 403 avisan con toast (el formulario se conserva). */
  private handleError(err: ApiError): void {
    if (err.status === 409) {
      const field: Field = /dni/i.test(err.rawMessage) ? 'dni' : 'email';
      this.form.controls[field].setErrors({ server: err.message });
      this.form.controls[field].markAsTouched();
      return;
    }
    if (err.status === 400) {
      const unmatched = applyServerErrors(this.form, err);
      if (unmatched.length || !Object.keys(err.fieldErrors).length) {
        this.toast.error(err.message, 'Revisa los datos');
      }
      return;
    }
    notify(this.toast, err);
  }
}
