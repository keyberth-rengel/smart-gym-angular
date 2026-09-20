import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { MeApi } from '../../../core/api/me.api';
import { createFakeClerk, fakeUser, provideFakeClerk } from '../../../testing/fake-clerk';
import { Navbar, initialsOf } from './navbar';

function setup(user: ReturnType<typeof fakeUser>) {
  const clerk = createFakeClerk({ user });
  TestBed.configureTestingModule({
    providers: [provideRouter([{ path: 'auth/sign-in', children: [] }]), provideFakeClerk(clerk), { provide: MeApi, useValue: { getMe: () => of({}) } }],
  });
  const fixture = TestBed.createComponent(Navbar);
  fixture.detectChanges();
  return { clerk, fixture, el: fixture.nativeElement as HTMLElement };
}
const q = (el: HTMLElement, id: string) => el.querySelector(`[data-testid=${id}]`);

describe('initialsOf', () => {
  it.each([
    ['Carlos Mendoza', 'CM'],
    ['ana', 'AN'],
    ['Lucía de la Paz', 'LD'],
    ['carlos.mendoza@correo.com', 'CM'],
    ['sg+clerk_test@example.com', 'SC'],
    ['', '?'],
    [null, '?'],
  ])('%s -> %s', (name, expected) => expect(initialsOf(name as string | null)).toBe(expected));
});

describe('Navbar', () => {
  it('cliente: iniciales, nombre, correo y sin badge', () => {
    const { el } = setup(fakeUser({ name: 'Carlos Mendoza', email: 'Carlos@correo.com' }));
    expect(q(el, 'navbar-initials')?.textContent?.trim()).toBe('CM');
    expect(q(el, 'navbar-name')?.textContent?.trim()).toBe('Carlos Mendoza');
    expect(q(el, 'navbar-sub')?.textContent?.trim()).toBe('carlos@correo.com');
    expect(q(el, 'navbar-role-badge')).toBeNull();
  });

  it.each([
    ['admin', 'ADMIN'],
    ['entrenador', 'ENTRENADOR'],
  ])('rol %s muestra el badge %s', (role, text) => {
    const { el } = setup(fakeUser({ role }));
    expect(q(el, 'navbar-role-badge')?.textContent?.trim()).toBe(text);
  });

  it('sin nombre en Clerk usa el correo y el rol como subtítulo', () => {
    const { el } = setup(fakeUser({ name: null, email: 'ana@correo.com', role: 'admin' }));
    expect(q(el, 'navbar-name')?.textContent?.trim()).toBe('ana@correo.com');
    expect(q(el, 'navbar-sub')?.textContent?.trim()).toBe('Administración');
  });

  it('Salir cierra la sesión en Clerk', async () => {
    const { clerk, fixture, el } = setup(fakeUser());
    (q(el, 'sign-out') as HTMLButtonElement).click();
    await fixture.whenStable();
    await vi.waitFor(() => expect(TestBed.inject(Router).url).toBe('/auth/sign-in'));
    expect(clerk.signOutCalls).toBe(1);
  });
});
