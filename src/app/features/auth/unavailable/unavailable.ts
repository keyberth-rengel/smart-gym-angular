import { Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService, MeErrorKind } from '../../../core/auth/auth.service';
import { AuthLayout } from '../auth-layout/auth-layout';

interface Copy {
  badge: string;
  title: string;
  text: string;
}

const COPY: Record<MeErrorKind, Copy> = {
  network: {
    badge: 'Sin conexión con el servicio',
    title: 'No pudimos cargar tu perfil',
    text: 'El servidor de SmartGym no está respondiendo. Revisa tu conexión e inténtalo de nuevo.',
  },
  server: {
    badge: 'Sin conexión con el servicio',
    title: 'No pudimos cargar tu perfil',
    text: 'El servidor de SmartGym no está respondiendo. Revisa tu conexión e inténtalo de nuevo.',
  },
  forbidden: {
    badge: 'Sesión incompleta',
    title: 'Tu sesión no está lista',
    text: 'Tu sesión no incluye el correo de tu cuenta. Cierra sesión e inicia de nuevo; si continúa, avisa al administrador.',
  },
  unauthorized: {
    badge: 'Sesión vencida',
    title: 'Vuelve a iniciar sesión',
    text: 'Tu sesión ya no es válida. Cierra sesión e inicia de nuevo.',
  },
  clerk: {
    badge: 'Sin conexión con el servicio',
    title: 'No pudimos iniciar tu sesión',
    text: 'No se pudo cargar el servicio de acceso. Revisa tu conexión e inténtalo de nuevo.',
  },
  'profile-pending': {
    badge: 'Registro pendiente',
    title: 'Tu cuenta de entrenador aún no está registrada',
    text: 'El administrador debe completar tu registro en SmartGym. Cuando lo haga, pulsa Reintentar.',
  },
};

/** No se pudo cargar el perfil: explica el motivo y permite reintentar o salir. */
@Component({
  selector: 'app-unavailable',
  imports: [AuthLayout],
  template: `
    <app-auth-layout>
      <section class="sg-auth-card" aria-labelledby="un-title">
        <span class="sg-badge sg-badge-amber" data-testid="un-badge">{{ copy().badge }}</span>
        <h1 id="un-title" class="display-6 mb-0">{{ copy().title }}</h1>
        <p class="mb-0 text-body-secondary" data-testid="un-text">{{ copy().text }}</p>
        <button
          type="button"
          class="btn btn-primary w-100"
          (click)="retry()"
          [disabled]="busy()"
          data-testid="retry"
        >
          <i class="bi bi-arrow-clockwise" aria-hidden="true"></i><span>Reintentar</span>
        </button>
        @if (auth.meError() !== 'clerk') {
          <button type="button" class="btn btn-outline-secondary w-100" (click)="auth.signOut()">
            <i class="bi bi-box-arrow-right" aria-hidden="true"></i><span>Salir</span>
          </button>
        }
      </section>
    </app-auth-layout>
  `,
})
export class Unavailable {
  protected readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  protected readonly busy = signal(false);

  protected readonly copy = computed(() => COPY[this.auth.meError() ?? 'network']);

  protected async retry(): Promise<void> {
    // Sin Clerk no hay nada que reintentar en la app: se recarga la página para volver a pedir su script.
    if (this.auth.meError() === 'clerk') {
      window.location.reload();
      return;
    }
    this.busy.set(true);
    try {
      await this.auth.loadMe(true);
    } catch {
      // Sigue sin cargar: los guards devuelven a esta pantalla con el motivo actualizado.
    }
    // "/" vuelve a decidir según el estado actual (inicio del rol o de nuevo esta pantalla).
    await this.router.navigateByUrl('/');
    this.busy.set(false);
  }
}
