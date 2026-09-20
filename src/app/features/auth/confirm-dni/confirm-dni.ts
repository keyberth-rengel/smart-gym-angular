import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { MeApi } from '../../../core/api/me.api';
import { AuthService } from '../../../core/auth/auth.service';
import { ApiError } from '../../../core/http/api-error';
import { applyServerErrors, dniValidator, errorMessage } from '../../../core/util/validators';
import { ToastService } from '../../../shared/ui/toast/toast.service';
import { AuthLayout } from '../auth-layout/auth-layout';

/**
 * Paso "confirma tu DNI" para clientes con perfil completo cuyo DNI aún no está guardado en
 * Clerk. Solo lo acepta si el DNI ya está vinculado a su propio correo. Interino hasta B2.
 */
@Component({
  selector: 'app-confirm-dni',
  imports: [ReactiveFormsModule, AuthLayout],
  templateUrl: './confirm-dni.html',
})
export class ConfirmDni {
  protected readonly auth = inject(AuthService);
  private readonly me = inject(MeApi);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);

  protected readonly submitting = signal(false);
  protected readonly form = inject(FormBuilder).nonNullable.group({
    dni: ['', [Validators.required, dniValidator]],
  });

  protected error(): string | null {
    const control = this.form.controls.dni;
    return control.touched || control.dirty ? errorMessage(control) : null;
  }

  protected submit(): void {
    if (this.submitting()) return;
    this.form.markAllAsTouched();
    const email = this.auth.email();
    if (this.form.invalid || !email) return;

    const dni = this.form.controls.dni.value.trim();
    this.submitting.set(true);
    this.me.confirmDni(dni, email).subscribe({
      next: () => void this.save(dni),
      error: (err: unknown) => {
        this.submitting.set(false);
        if (err instanceof ApiError) applyServerErrors(this.form, err);
      },
    });
  }

  private async save(dni: string): Promise<void> {
    try {
      await this.auth.saveDni(dni);
    } catch {
      this.submitting.set(false);
      this.toast.error('No pudimos guardar tu DNI. Inténtalo de nuevo.', 'Error');
      return;
    }
    await this.router.navigateByUrl(this.auth.home());
  }
}
