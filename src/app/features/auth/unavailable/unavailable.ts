import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../../core/auth/auth.service';
import { AuthLayout } from '../auth-layout/auth-layout';

/** El backend no respondió al cargar el perfil: permite reintentar o salir. */
@Component({
  selector: 'app-unavailable',
  imports: [AuthLayout],
  template: `
    <app-auth-layout>
      <section class="sg-auth-card" aria-labelledby="un-title">
        <span class="sg-badge sg-badge-amber">Sin conexión con el servicio</span>
        <h1 id="un-title" class="display-6 mb-0">No pudimos cargar tu perfil</h1>
        <p class="mb-0 text-body-secondary">
          El servidor de SmartGym no está respondiendo. Revisa tu conexión e inténtalo de nuevo.
        </p>
        <button type="button" class="btn btn-primary w-100" (click)="retry()" [disabled]="busy()" data-testid="retry">
          <i class="bi bi-arrow-clockwise" aria-hidden="true"></i><span>Reintentar</span>
        </button>
        <button type="button" class="btn btn-outline-secondary w-100" (click)="auth.signOut()">
          <i class="bi bi-box-arrow-right" aria-hidden="true"></i><span>Salir</span>
        </button>
      </section>
    </app-auth-layout>
  `,
})
export class Unavailable {
  protected readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  protected readonly busy = signal(false);

  protected async retry(): Promise<void> {
    this.busy.set(true);
    // Los guards vuelven a consultar el perfil; si falla otra vez regresa aquí con su toast.
    await this.router.navigateByUrl(this.auth.home());
    this.busy.set(false);
  }
}
