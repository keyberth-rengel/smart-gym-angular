import { Injectable, signal } from '@angular/core';

export interface ConfirmOptions {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Acción destructiva: el botón de confirmar va en rojo. */
  danger?: boolean;
}

export interface ConfirmRequest {
  options: Required<ConfirmOptions>;
}

/**
 * Pide una confirmación al usuario. `ConfirmDialog` (montado una vez en la app) muestra la
 * petición activa; si llegan varias, se atienden una tras otra.
 */
@Injectable({ providedIn: 'root' })
export class ConfirmService {
  private readonly _request = signal<ConfirmRequest | null>(null);
  readonly request = this._request.asReadonly();

  private resolveCurrent: ((value: boolean) => void) | null = null;
  private queue: Promise<unknown> = Promise.resolve();

  confirm(options: ConfirmOptions): Promise<boolean> {
    const result = this.queue.then(() => this.open(options));
    this.queue = result.catch(() => undefined);
    return result;
  }

  /** La llama el diálogo al cerrarse: `true` solo si el usuario confirmó. */
  settle(result: boolean): void {
    const resolve = this.resolveCurrent;
    this.resolveCurrent = null;
    this._request.set(null);
    resolve?.(result);
  }

  private open(options: ConfirmOptions): Promise<boolean> {
    return new Promise<boolean>((resolve) => {
      this.resolveCurrent = resolve;
      this._request.set({
        options: {
          confirmLabel: 'Confirmar',
          cancelLabel: 'Volver',
          danger: false,
          ...options,
        },
      });
    });
  }
}
