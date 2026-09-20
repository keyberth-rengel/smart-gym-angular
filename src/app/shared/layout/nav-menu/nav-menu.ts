import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { NavItem } from '../../../core/nav/nav-items';

/**
 * Menú del rol: barra lateral vertical desde 768 px y pestañas horizontales por debajo.
 * Es un único `<nav>`; el cambio es solo de estilos, así no hay enlaces duplicados.
 */
@Component({
  selector: 'app-nav-menu',
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './nav-menu.html',
  styleUrl: './nav-menu.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NavMenu {
  readonly items = input.required<readonly NavItem[]>();
}
