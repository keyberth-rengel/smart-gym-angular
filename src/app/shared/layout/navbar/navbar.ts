import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { AuthService } from '../../../core/auth/auth.service';
import { ROLE_BADGE, ROLE_LABEL } from '../../../core/nav/nav-items';
import { Badge } from '../../ui/badge/badge';

/** Iniciales para el avatar: "Carlos Mendoza" -> CM; un correo usa su parte local. */
export function initialsOf(name: string | null | undefined): string {
  const raw = (name ?? '').trim();
  if (!raw) return '?';
  const base = raw.includes('@') ? raw.split('@')[0] : raw;
  const tokens = base.split(/[\s._+-]+/).filter(Boolean);
  if (tokens.length >= 2) return (tokens[0][0] + tokens[1][0]).toUpperCase();
  return base.slice(0, 2).toUpperCase() || '?';
}

@Component({
  selector: 'app-navbar',
  imports: [Badge],
  templateUrl: './navbar.html',
  styleUrl: './navbar.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Navbar {
  protected readonly auth = inject(AuthService);

  protected readonly name = computed(() => this.auth.fullName() ?? '');
  protected readonly initials = computed(() => initialsOf(this.name()));
  protected readonly badge = computed(() => {
    const role = this.auth.role();
    return role ? ROLE_BADGE[role] : null;
  });
  /** Subtítulo: el correo o, si el nombre ya es el correo, el rol. */
  protected readonly subtitle = computed(() => {
    const email = this.auth.email();
    const role = this.auth.role();
    return email && email !== this.name() ? email : role ? ROLE_LABEL[role] : '';
  });

  protected signOut(): void {
    void this.auth.signOut();
  }
}
