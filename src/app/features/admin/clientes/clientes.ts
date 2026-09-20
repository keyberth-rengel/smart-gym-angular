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
import { CustomersApi } from '../../../core/api/customers.api';
import { ApiError } from '../../../core/http/api-error';
import { notify, skipErrorToast } from '../../../core/http/error.interceptor';
import { Customer } from '../../../core/models';
import { ADMIN_MAX_AGE } from '../../../core/util/admin-view';
import {
  applyServerErrors,
  dniValidator,
  errorMessage,
  integerValidator,
  noAngleBracketsValidator,
} from '../../../core/util/validators';
import { PageHeader } from '../../../shared/ui/page-header/page-header';
import { ToastService } from '../../../shared/ui/toast/toast.service';
import { RegistryColumn, RegistryList, RegistryStatus } from '../shared/registry-list';

type Field = 'name' | 'email' | 'age' | 'dni';

/** Clientes (admin): registrar un cliente (con DNI opcional) y consultar el padrón. */
@Component({
  selector: 'app-admin-clientes',
  imports: [ReactiveFormsModule, PageHeader, RegistryList],
  host: { class: 'sg-page' },
  templateUrl: './clientes.html',
  styleUrl: './clientes.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminClientes {
  private readonly api = inject(CustomersApi);
  private readonly toast = inject(ToastService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly status = signal<RegistryStatus>('loading');
  /** La lista falló con un 403 (la cuenta no es admin). */
  protected readonly forbidden = signal(false);
  protected readonly customers = signal<Customer[]>([]);
  protected readonly rows = computed(() => this.customers().map((c) => ({ ...c })));
  protected readonly columns: readonly RegistryColumn[] = [
    { key: 'name', label: 'Nombre' },
    { key: 'email', label: 'Correo', muted: true },
    { key: 'age', label: 'Edad', end: true },
  ];

  protected readonly submitting = signal(false);
  protected readonly form = inject(FormBuilder).nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(120), noAngleBracketsValidator]],
    email: ['', [Validators.required, Validators.email]],
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
          this.customers.set(list);
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

    const { name, email, age, dni } = this.form.getRawValue();
    const body = {
      name: name.trim(),
      email: email.trim(),
      age: Number(age),
      ...(dni.trim() ? { dni: dni.trim() } : {}),
    };
    this.submitting.set(true);
    this.api
      .create(body, skipErrorToast())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.submitting.set(false);
          this.toast.success(`Cliente ${body.name} registrado.`);
          this.form.reset();
          this.load();
        },
        error: (err: unknown) => {
          this.submitting.set(false);
          if (err instanceof ApiError) this.handleError(err);
        },
      });
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
