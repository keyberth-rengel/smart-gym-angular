import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  effect,
  inject,
  viewChild,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { filter, map } from 'rxjs';
import { AuthService } from '../../../core/auth/auth.service';
import { NAV_ITEMS } from '../../../core/nav/nav-items';
import { Navbar } from '../navbar/navbar';
import { NavMenu } from '../nav-menu/nav-menu';

const MOBILE_QUERY = '(max-width: 767.98px)';

/** Marco de las pantallas autenticadas: header, menú del rol y contenido. */
@Component({
  selector: 'app-shell',
  imports: [Navbar, NavMenu, RouterOutlet],
  templateUrl: './shell.html',
  styleUrl: './shell.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Shell {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly menu = viewChild('menu', { read: ElementRef });
  private readonly main = viewChild.required<ElementRef<HTMLElement>>('main');

  protected readonly items = computed(() => {
    const role = this.auth.role();
    return role ? NAV_ITEMS[role] : [];
  });

  private readonly url = toSignal(
    this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd),
      map((e) => e.urlAfterRedirects),
    ),
    { initialValue: this.router.url },
  );

  constructor() {
    // En móvil las pestañas hacen scroll: la activa siempre queda a la vista.
    effect(() => {
      this.url();
      this.items();
      const host = this.menu()?.nativeElement as HTMLElement | undefined;
      if (!host) return;
      queueMicrotask(() =>
        setTimeout(() => {
          if (typeof matchMedia !== 'function' || !matchMedia(MOBILE_QUERY).matches) return;
          host
            .querySelector<HTMLElement>('[aria-current="page"]')
            ?.scrollIntoView?.({ inline: 'center', block: 'nearest' });
        }),
      );
    });
  }

  /** "Saltar al contenido": el ancla `#contenido` chocaría con `<base href="/">`. */
  protected skipToContent(event: Event): void {
    event.preventDefault();
    const main = this.main().nativeElement;
    main.focus();
    main.scrollIntoView?.({ block: 'start' });
  }
}
