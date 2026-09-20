import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { MeApi } from '../../../core/api/me.api';
import { AuthService } from '../../../core/auth/auth.service';
import { ApiError } from '../../../core/http/api-error';
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

/** Primer ingreso de un cliente: completa edad y DNI para vincular su cuenta. */
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

  /** Guarda el DNI y el nombre en Clerk (mejor esfuerzo) y entra a la app. */
  private async finish(name: string, dni: string): Promise<void> {
    await this.auth.syncClerkName(name);
    try {
      await this.auth.saveDni(dni);
    } catch {
      // El DNI ya está vinculado en el backend; si Clerk falla, `/auth/confirm-dni` lo pedirá de nuevo.
    }
    this.auth.markProfileComplete();
    this.toast.success('Perfil completado. ¡Bienvenido a SmartGym!');
    await this.router.navigateByUrl(this.auth.home());
  }

  protected submit(): void {
    if (this.submitting()) return;
    this.form.markAllAsTouched();
    if (this.form.invalid) return;

    const email = this.auth.email();
    if (!email) return;

    const { name, age, dni } = this.form.getRawValue();
    this.submitting.set(true);
    this.me
      .completeOnboarding({
        name: name.trim(),
        email,
        age: Number(age),
        dni: dni.trim(),
      })
      .subscribe({
        next: () => void this.finish(name, dni.trim()),
        error: (err: unknown) => {
          this.submitting.set(false);
          if (!(err instanceof ApiError)) return;
          const unmatched = applyServerErrors(this.form, err);
          // 400 con campos sin control en el formulario: el interceptor no muestra toast.
          if (err.status === 400 && (unmatched.length || !Object.keys(err.fieldErrors).length)) {
            this.toast.error(err.message, 'Revisa los datos');
          }
        },
      });
  }
}
