import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { MeApi } from '../../../core/api/me.api';
import { AuthService } from '../../../core/auth/auth.service';
import { ApiError } from '../../../core/http/api-error';
import { notify } from '../../../core/http/error.interceptor';
import {
  applyServerErrors,
  dniValidator,
  errorMessage,
  integerValidator,
  noAngleBracketsValidator,
} from '../../../core/util/validators';
import { ToastService } from '../../../shared/ui/toast/toast.service';
import { AuthLayout } from '../auth-layout/auth-layout';

export const MIN_AGE = 14;
export const MAX_AGE = 100;

/** Primer ingreso de un cliente: completa nombre, edad y DNI para vincular su cuenta. */
@Component({
  selector: 'app-onboarding',
  imports: [ReactiveFormsModule, AuthLayout],
  templateUrl: './onboarding.html',
})
export class Onboarding {
  protected readonly auth = inject(AuthService);
  private readonly me = inject(MeApi);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);

  protected readonly submitting = signal(false);

  /** Con registro solo por correo Clerk no tiene nombre: se pide aquí. */
  protected readonly nameFromClerk = this.auth.clerkName() !== null;

  protected readonly form = inject(FormBuilder).nonNullable.group({
    name: [
      this.auth.clerkName() ?? '',
      [Validators.required, Validators.minLength(2), Validators.maxLength(120), noAngleBracketsValidator],
    ],
    age: ['', [Validators.required, integerValidator, Validators.min(MIN_AGE), Validators.max(MAX_AGE)]],
    dni: ['', [Validators.required, dniValidator]],
  });

  protected readonly minAge = MIN_AGE;
  protected readonly maxAge = MAX_AGE;

  /** Mensaje de error del campo, solo tras tocarlo o intentar enviar. */
  protected error(name: 'name' | 'age' | 'dni'): string | null {
    const control = this.form.controls[name];
    return control.touched || control.dirty ? errorMessage(control) : null;
  }

  protected submit(): void {
    if (this.submitting()) return;
    this.form.markAllAsTouched();
    if (this.form.invalid) return;

    const { name, age, dni } = this.form.getRawValue();
    this.submitting.set(true);
    this.me
      .completeOnboarding({ name: name.trim(), age: Number(age), dni: dni.trim() })
      .subscribe({
        next: (me) => {
          this.auth.applyMe(me);
          this.toast.success('Perfil completado. ¡Bienvenido a SmartGym!');
          void this.router.navigateByUrl(this.auth.home());
        },
        error: (err: unknown) => {
          this.submitting.set(false);
          if (!(err instanceof ApiError)) return;
          if (err.status === 409) {
            // DNI de otra cuenta, o cuenta que ya tiene otro DNI: se muestra junto al campo.
            this.form.controls.dni.setErrors({ server: err.message });
            this.form.controls.dni.markAsTouched();
            return;
          }
          if (err.status === 400) {
            const unmatched = applyServerErrors(this.form, err);
            if (unmatched.length || !Object.keys(err.fieldErrors).length) {
              this.toast.error(err.message, 'Revisa los datos');
            }
            return;
          }
          notify(this.toast, err); // red caída, 5xx, 403...: el formulario sigue utilizable
        },
      });
  }
}
