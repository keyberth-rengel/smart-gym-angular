import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Badge } from './badge/badge';
import { EmptyState } from './empty-state/empty-state';
import { Loading } from './loading/loading';
import { PageHeader } from './page-header/page-header';
import { StatCard } from './stat-card/stat-card';

@Component({
  imports: [Badge, EmptyState, PageHeader, StatCard, Loading],
  template: `
    <app-badge tone="red">Cancelada</app-badge>
    <app-stat-card icon="calendar-event" tone="blue" label="Reservas" value="Hoy · 18:30" sub="con Marco" linkText="Ver" linkTo="/x" />
    <app-stat-card icon="lightning-charge" label="Rutina" value="Cardio" />
    <app-empty-state title="Sin datos" text="Nada aún"><button>CTA</button></app-empty-state>
    <app-page-header title="Titulo" subtitle="Sub"><button actions>Acción</button></app-page-header>
    <app-loading variant="table" [rows]="3" />
    <app-loading />
  `,
})
class Host {}

describe('componentes UI básicos', () => {
  let el: HTMLElement;
  beforeEach(async () => {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    const f = TestBed.createComponent(Host);
    f.detectChanges();
    await f.whenStable();
    el = f.nativeElement;
  });

  it('Badge aplica la clase del tono', () => {
    expect(el.querySelector('.sg-badge')?.classList.contains('sg-badge-red')).toBe(true);
    expect(el.querySelector('.sg-badge')?.textContent).toContain('Cancelada');
  });

  it('StatCard: valor, subtexto, tono azul y enlace opcional', () => {
    const [a, b] = Array.from(el.querySelectorAll('[data-testid=stat-card]'));
    expect(a.classList.contains('tone-blue')).toBe(true);
    expect(a.querySelector('[data-testid=stat-value]')?.textContent?.trim()).toBe('Hoy · 18:30');
    expect(a.querySelector('.stat-sub')?.textContent).toContain('con Marco');
    expect(a.querySelector('a')?.getAttribute('href')).toBe('/x');
    expect(b.classList.contains('tone-blue')).toBe(false);
    expect(b.querySelector('a')).toBeNull();
    expect(b.querySelector('.stat-sub')).toBeNull();
  });

  it('EmptyState: título, texto y CTA proyectado', () => {
    const empty = el.querySelector('[data-testid=empty-state]')!;
    expect(empty.querySelector('h2')?.textContent).toBe('Sin datos');
    expect(empty.querySelector('.empty-text')?.textContent).toBe('Nada aún');
    expect(empty.querySelector('button')?.textContent).toBe('CTA');
  });

  it('PageHeader: título, subtítulo y acción proyectada', () => {
    expect(el.querySelector('[data-testid=page-title]')?.textContent).toBe('Titulo');
    expect(el.querySelector('[data-testid=page-subtitle]')?.textContent).toBe('Sub');
    expect(el.querySelector('.page-actions button')?.textContent).toBe('Acción');
  });

  it('Loading: esqueleto de tabla con N filas y spinner accesible', () => {
    expect(el.querySelectorAll('[data-testid=loading-table] .sk-row')).toHaveLength(3);
    expect(el.querySelector('[data-testid=loading-table]')?.getAttribute('aria-busy')).toBe('true');
    expect(el.querySelector('[data-testid=loading-spinner] .visually-hidden')?.textContent).toContain('Cargando');
  });
});
