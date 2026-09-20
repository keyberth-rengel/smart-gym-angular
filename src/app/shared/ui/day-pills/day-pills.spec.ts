import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { WeekdayKey } from '../../../core/models/routine';
import { DayPick, DayPills } from './day-pills';

@Component({
  imports: [DayPills],
  template: `<app-day-pills
    [plan]="plan"
    [today]="today"
    [(selected)]="selected"
    (picked)="picks.push($event)"
  />`,
})
class Host {
  plan = {
    monday: 'Legs',
    tuesday: 'Chest',
    wednesday: 'Back',
    thursday: 'Shoulders',
    friday: 'Arms',
    saturday: 'Cardio',
    sunday: null,
  };
  today: WeekdayKey = 'saturday';
  selected = signal<WeekdayKey | null>(null);
  picks: DayPick[] = [];
}

function setup() {
  const fixture = TestBed.createComponent(Host);
  fixture.detectChanges();
  const el = fixture.nativeElement as HTMLElement;
  const btn = (day: string) => el.querySelector<HTMLButtonElement>(`[data-day=${day}]`)!;
  return { fixture, el, btn, host: fixture.componentInstance };
}

describe('DayPills', () => {
  it('muestra 7 días con el bloque traducido y domingo "Descanso"', () => {
    const { el, btn } = setup();
    expect(el.querySelectorAll('button')).toHaveLength(7);
    expect(btn('monday').textContent).toContain('Piernas');
    expect(btn('tuesday').textContent).toContain('Pecho');
    expect(btn('saturday').textContent).toContain('Cardio');
    expect(btn('sunday').textContent).toContain('Descanso');
    expect(btn('sunday').querySelector('.pill-block-short')?.textContent).toBe('Desc.');
  });

  it('marca HOY solo en el día actual', () => {
    const { el } = setup();
    const hoy = Array.from(el.querySelectorAll('button')).filter((b) =>
      b.textContent?.includes('HOY'),
    );
    expect(hoy).toHaveLength(1);
    expect(hoy[0].getAttribute('data-day')).toBe('saturday');
  });

  it('click selecciona (aria-pressed) y emite hasPlan=true', () => {
    const { fixture, btn, host } = setup();
    btn('wednesday').click();
    fixture.detectChanges();
    expect(host.selected()).toBe('wednesday');
    expect(btn('wednesday').getAttribute('aria-pressed')).toBe('true');
    expect(btn('monday').getAttribute('aria-pressed')).toBe('false');
    expect(host.picks.at(-1)).toEqual({ day: 'wednesday', hasPlan: true });
  });

  it('domingo emite hasPlan=false (no se consulta el API)', () => {
    const { btn, host } = setup();
    btn('sunday').click();
    expect(host.picks.at(-1)).toEqual({ day: 'sunday', hasPlan: false });
  });

  it('las flechas mueven el foco, con vuelta al inicio y al final; Home y End', () => {
    const { el, btn } = setup();
    document.body.appendChild(el);
    const key = (day: string, k: string) =>
      btn(day).dispatchEvent(
        new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true }),
      );
    btn('monday').focus();
    key('monday', 'ArrowRight');
    expect(document.activeElement).toBe(btn('tuesday'));
    key('tuesday', 'ArrowLeft');
    key('monday', 'ArrowLeft');
    expect(document.activeElement).toBe(btn('sunday'));
    key('sunday', 'ArrowRight');
    expect(document.activeElement).toBe(btn('monday'));
    key('monday', 'End');
    expect(document.activeElement).toBe(btn('sunday'));
    key('sunday', 'Home');
    expect(document.activeElement).toBe(btn('monday'));
    el.remove();
  });

  it('Enter/espacio activan el botón nativo (son <button type=button>)', () => {
    const { el } = setup();
    expect(Array.from(el.querySelectorAll('button')).every((b) => b.type === 'button')).toBe(true);
  });
});
