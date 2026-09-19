import { Injectable, signal } from '@angular/core';

export type ToastKind = 'success' | 'error' | 'warning' | 'info';

export interface Toast {
  id: number;
  kind: ToastKind;
  title: string;
  message: string;
}

export const MAX_TOASTS = 4;
export const TOAST_DURATION_MS = 5000;
export const TOAST_ERROR_DURATION_MS = 7000;

const DEFAULT_TITLES: Record<ToastKind, string> = {
  success: 'Listo',
  error: 'Ocurrió un problema',
  warning: 'Atención',
  info: 'Información',
};

@Injectable({ providedIn: 'root' })
export class ToastService {
  private readonly _toasts = signal<Toast[]>([]);
  readonly toasts = this._toasts.asReadonly();

  private nextId = 1;
  private readonly timers = new Map<number, ReturnType<typeof setTimeout>>();

  success(message: string, title?: string): number {
    return this.show('success', message, title);
  }

  error(message: string, title?: string): number {
    return this.show('error', message, title);
  }

  warning(message: string, title?: string): number {
    return this.show('warning', message, title);
  }

  info(message: string, title?: string): number {
    return this.show('info', message, title);
  }

  show(kind: ToastKind, message: string, title?: string): number {
    const id = this.nextId++;
    const toast: Toast = { id, kind, message, title: title ?? DEFAULT_TITLES[kind] };

    const list = [...this._toasts(), toast];
    // Máximo apilado: descarta los más antiguos.
    while (list.length > MAX_TOASTS) {
      const removed = list.shift()!;
      this.clearTimer(removed.id);
    }
    this._toasts.set(list);

    const ms = kind === 'error' ? TOAST_ERROR_DURATION_MS : TOAST_DURATION_MS;
    this.timers.set(
      id,
      setTimeout(() => this.dismiss(id), ms),
    );
    return id;
  }

  dismiss(id: number): void {
    this.clearTimer(id);
    this._toasts.update((list) => list.filter((t) => t.id !== id));
  }

  private clearTimer(id: number): void {
    const timer = this.timers.get(id);
    if (timer !== undefined) {
      clearTimeout(timer);
      this.timers.delete(id);
    }
  }
}
