import { HttpContext } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  inject,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ProgressApi } from '../../../core/api/progress.api';
import { AuthService } from '../../../core/auth/auth.service';
import { ApiError } from '../../../core/http/api-error';
import { SKIP_ERROR_TOAST } from '../../../core/http/error.interceptor';
import {
  applyServerErrors,
  errorMessage,
  percentValidator,
  weightValidator,
} from '../../../core/util/validators';
import { ToastService } from '../../../shared/ui/toast/toast.service';

type Field = 'weightKg' | 'bodyFatPct' | 'musclePct';

/** Diálogo nativo `<dialog>` para registrar el progreso del día (un registro por día). */
@Component({
  selector: 'app-progress-dialog',
  imports: [ReactiveFormsModule],
  templateUrl: './progress-dialog.html',
  styleUrl: './progress-dialog.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProgressDialog {
  private readonly api = inject(ProgressApi);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);

  /** Se emite tras guardar con éxito, para que la pantalla refresque sus datos. */
  readonly saved = output<void>();

  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');
  private readonly firstField = viewChild<ElementRef<HTMLInputElement>>('firstField');

  protected readonly submitting = signal(false);
  /** Mensaje del servidor que no pertenece a un campo (409 de "ya registraste hoy", 422...). */
  protected readonly formError = signal<string | null>(null);

  protected readonly who = computed(() => `DNI ${this.auth.dni() ?? '—'} · ${this.auth.fullName() ?? ''}`);

  protected readonly form = inject(FormBuilder).nonNullable.group({
    weightKg: ['', [Validators.required, weightValidator]],
    bodyFatPct: ['', [Validators.required, percentValidator]],
    musclePct: ['', [Validators.required, percentValidator]],
  });

  open(): void {
    this.form.reset({ weightKg: '', bodyFatPct: '', musclePct: '' });
    this.formError.set(null);
    this.submitting.set(false);
    this.dialog().nativeElement.showModal();
    this.firstField()?.nativeElement.focus();
  }

  protected close(): void {
    this.dialog().nativeElement.close();
  }

  protected error(name: Field): string | null {
    const control = this.form.controls[name];
    return control.touched || control.dirty ? errorMessage(control) : null;
  }

  /** Clic en el fondo oscuro (fuera del contenido) cierra el diálogo. */
  protected onBackdropClick(event: MouseEvent): void {
    if (event.target === this.dialog().nativeElement) this.close();
  }

  protected submit(): void {
    if (this.submitting()) return;
    this.form.markAllAsTouched();
    const dni = this.auth.dni();
    if (this.form.invalid || !dni) return;

    const v = this.form.getRawValue();
    this.submitting.set(true);
    this.formError.set(null);
    this.api
      .add(
        {
          dni,
          weightKg: Number(v.weightKg),
          bodyFatPct: Number(v.bodyFatPct),
          musclePct: Number(v.musclePct),
        },
        // El error se muestra dentro del diálogo; los cortes de servicio siguen avisando con toast.
        { context: new HttpContext().set(SKIP_ERROR_TOAST, true) },
      )
      .subscribe({
        next: () => {
          this.submitting.set(false);
          this.close();
          this.toast.success('Tu progreso de hoy quedó registrado.');
          this.saved.emit();
        },
        error: (err: unknown) => {
          this.submitting.set(false);
          if (!(err instanceof ApiError)) return;
          if (err.isNetwork || err.isServer) {
            this.toast.error(err.message, 'Servicio no disponible');
            return;
          }
          const unmatched = applyServerErrors(this.form, err);
          if (err.status === 409) {
            this.formError.set('Ya registraste tu progreso hoy. Solo se permite un registro por día.');
          } else if (unmatched.length || !Object.keys(err.fieldErrors).length) {
            this.formError.set(err.message);
          }
        },
      });
  }
}
