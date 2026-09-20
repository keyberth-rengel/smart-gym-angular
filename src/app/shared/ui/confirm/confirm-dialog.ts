import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  effect,
  inject,
  viewChild,
  afterNextRender,
} from '@angular/core';
import { ConfirmService } from './confirm.service';

/** Diálogo de confirmación sobre `<dialog>` nativo: foco atrapado, Esc y fondo inerte de serie. */
@Component({
  selector: 'app-confirm-dialog',
  templateUrl: './confirm-dialog.html',
  styleUrl: './confirm-dialog.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ConfirmDialog {
  protected readonly service = inject(ConfirmService);
  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');
  private readonly cancelButton = viewChild<ElementRef<HTMLButtonElement>>('cancelButton');

  /** El clic en el fondo se escucha desde TS: es un atajo de ratón; con teclado se cierra con Esc o el botón. */
  private readonly backdropListener = afterNextRender(() => {
    this.dialog().nativeElement.addEventListener('click', (event) => this.onBackdropClick(event));
  });

  constructor() {
    effect(() => {
      const request = this.service.request();
      const dialog = this.dialog().nativeElement;
      if (request && !dialog.open) {
        dialog.returnValue = '';
        dialog.showModal();
        // La plantilla se pinta en el siguiente ciclo: el foco inicial va en "Volver".
        queueMicrotask(() => this.cancelButton()?.nativeElement.focus());
      }
    });
  }

  protected close(confirmed: boolean): void {
    this.dialog().nativeElement.close(confirmed ? 'confirm' : 'cancel');
  }

  /** Cierre nativo (Esc, o `close()` propio): solo "confirm" cuenta como sí. */
  protected onClosed(): void {
    const confirmed = this.dialog().nativeElement.returnValue === 'confirm';
    this.service.settle(confirmed);
  }

  /** Clic en el fondo (el propio `<dialog>` fuera de su contenido) cancela. */
  protected onBackdropClick(event: MouseEvent): void {
    if (event.target === this.dialog().nativeElement) this.close(false);
  }
}
