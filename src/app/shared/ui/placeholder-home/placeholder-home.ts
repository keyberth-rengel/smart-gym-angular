import { Component, inject, input } from '@angular/core';
import { ClerkUserButtonComponent } from 'ngx-clerk';
import { AuthService } from '../../../core/auth/auth.service';

/** Inicio provisional por rol; lo reemplazan las pantallas reales de F3–F6. */
@Component({
  selector: 'app-placeholder-home',
  imports: [ClerkUserButtonComponent],
  template: `
    <div class="container py-5" style="max-width: 720px">
      <div class="card">
        <div class="card-body d-flex flex-column gap-3">
          <div class="d-flex align-items-center justify-content-between gap-3">
            <div class="d-flex align-items-center gap-3">
              <span class="sg-logo"><i class="bi bi-lightning-charge-fill" aria-hidden="true"></i></span>
              <span class="sg-brand">SMARTGYM</span>
            </div>
            <clerk-user-button />
          </div>
          <h1 class="mb-0" data-testid="home-title">{{ title() }}</h1>
          <div>
            <div class="fw-semibold" data-testid="home-name">{{ auth.fullName() }}</div>
            <div class="text-body-secondary" data-testid="home-email">{{ auth.email() }}</div>
            <span class="sg-badge sg-badge-green mt-2" data-testid="home-role">{{ auth.role() }}</span>
          </div>
          <p class="mb-0 text-body-secondary">Pantalla provisional de la fase F2.</p>
          <button type="button" class="btn btn-outline-secondary align-self-start" (click)="auth.signOut()" data-testid="sign-out">
            <i class="bi bi-box-arrow-right" aria-hidden="true"></i><span>Salir</span>
          </button>
        </div>
      </div>
    </div>
  `,
})
export class PlaceholderHome {
  protected readonly auth = inject(AuthService);
  readonly title = input.required<string>();
}
