import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { MeApi } from '../../../core/api/me.api';
import { NAV_ITEMS } from '../../../core/nav/nav-items';
import { AuthService } from '../../../core/auth/auth.service';
import { Me } from '../../../core/models';
import { createFakeClerk, fakeUser, provideFakeClerk } from '../../../testing/fake-clerk';
import { testMe } from '../../../testing/test-me';
import { Shell } from './shell';

async function render(role: string) {
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      provideFakeClerk(createFakeClerk({ user: fakeUser({ email: 'ana@correo.com' }) })),
      { provide: MeApi, useValue: { getMe: () => of({}) } },
    ],
  });
  TestBed.inject(AuthService).applyMe(testMe({ role: role as Me['role'] }));
  const fixture = TestBed.createComponent(Shell);
  fixture.detectChanges();
  await fixture.whenStable();
  return fixture.nativeElement as HTMLElement;
}

describe('Shell', () => {
  it.each(['cliente', 'entrenador', 'admin'] as const)('%s: renderiza exactamente su menú', async (role) => {
    const el = await render(role);
    const labels = Array.from(el.querySelectorAll('[data-testid=nav-item]')).map((a) => a.textContent?.trim());
    expect(labels).toEqual(NAV_ITEMS[role].map((i) => i.label));
    const hrefs = Array.from(el.querySelectorAll('[data-testid=nav-item]')).map((a) => a.getAttribute('href'));
    expect(hrefs).toEqual(NAV_ITEMS[role].map((i) => i.path));
  });

  it('tiene landmarks: header, nav con nombre, main enfocable y enlace para saltar al contenido', async () => {
    const el = await render('cliente');
    expect(el.querySelector('header')).not.toBeNull();
    expect(el.querySelector('nav')?.getAttribute('aria-label')).toBe('Navegación principal');
    const main = el.querySelector('main')!;
    expect(main.getAttribute('id')).toBe('contenido');
    expect(main.getAttribute('tabindex')).toBe('-1');
    expect(el.querySelector('.skip-link')?.textContent).toContain('Saltar al contenido');
  });

  it('saltar al contenido enfoca el main', async () => {
    const el = await render('cliente');
    document.body.appendChild(el);
    (el.querySelector('.skip-link') as HTMLAnchorElement).click();
    expect(document.activeElement).toBe(el.querySelector('main'));
    el.remove();
  });
});
