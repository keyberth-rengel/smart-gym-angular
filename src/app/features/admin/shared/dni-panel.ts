import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { dniValidator, errorMessage } from '../../../core/util/validators';

export type DniAction = 'primary' | 'secondary';

/**
 * Panel de búsqueda por DNI del admin (Rutinas y Asistencia): un campo de 8 dígitos y dos acciones.
 * Valida el DNI antes de emitir y no deja enviar mientras hay una acción en curso (`busy`); el
 * error que devuelve el servidor para ese DNI (por ejemplo "no vinculado") llega por `fieldError`.
 */
@Component({
  selector: 'app-dni-panel',
  imports: [ReactiveFormsModule],
  templateUrl: './dni-panel.html',
  styleUrl: './dni-panel.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DniPanel {
  readonly label = input('DNI del cliente');
  readonly hint = input<string>();
  readonly primaryLabel = input.required<string>();
  readonly primaryIcon = input('check2-circle');
  readonly secondaryLabel = input.required<string>();
  readonly secondaryIcon = input('clock-history');
  /**
   * Acción que ejecuta la tecla Enter en el campo. En pantallas donde la principal modifica datos
   * (asignar una rutina) conviene `secondary` para que Enter solo consulte.
   */
  readonly enterAction = input<DniAction>('primary');
  /** Acción en curso: deshabilita ambos botones y muestra el indicador en esa. */
  readonly busy = input<DniAction | null>(null);
  /** Error del servidor para el DNI escrito; se limpia al editar el campo. */
  readonly fieldError = input<string | null>(null);

  readonly primary = output<string>();
  readonly secondary = output<string>();
  /** El usuario editó el DNI: el padre debe limpiar `fieldError` y los mensajes de la consulta anterior. */
  readonly edited = output<void>();

  protected readonly control = new FormControl('', {
    nonNullable: true,
    validators: [Validators.required, dniValidator],
  });
  private readonly value = toSignal(this.control.valueChanges, { initialValue: '' });
  private readonly touched = signal(false);

  /** Error de validación del DNI, solo tras tocar el campo o intentar enviar. */
  protected readonly clientError = computed(() => {
    this.value();
    return this.touched() ? errorMessage(this.control) : null;
  });
  protected readonly message = computed(() => this.clientError() ?? this.fieldError());

  protected onInput(): void {
    this.edited.emit();
  }

  protected onBlur(): void {
    this.touched.set(true);
  }

  protected run(action: DniAction): void {
    if (this.busy()) return;
    this.touched.set(true);
    if (this.control.invalid) return;
    const dni = this.control.value.trim();
    (action === 'primary' ? this.primary : this.secondary).emit(dni);
  }
}
