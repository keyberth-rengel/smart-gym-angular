import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DniAction, DniPanel } from './dni-panel';

@Component({
  imports: [DniPanel],
  template: `
    <app-dni-panel
      primaryLabel="Registrar ingreso"
      secondaryLabel="Ver historial"
      [hint]="'Ayuda del panel'"
      [enterAction]="enter()"
      [busy]="busy()"
      [fieldError]="fieldError()"
      (primary)="primaries.push($event)"
      (secondary)="secondaries.push($event)"
      (edited)="edits = edits + 1"
    />
  `,
})
class Host {
  busy = signal<DniAction | null>(null);
  enter = signal<DniAction>('primary');
  fieldError = signal<string | null>(null);
  primaries: string[] = [];
  secondaries: string[] = [];
  edits = 0;
}

describe('DniPanel', () => {
  let fixture: ComponentFixture<Host>;
  let host: Host;
  let el: HTMLElement;

  beforeEach(() => {
    fixture = TestBed.createComponent(Host);
    host = fixture.componentInstance;
    el = fixture.nativeElement;
    fixture.detectChanges();
  });

  const q = <T extends HTMLElement>(s: string) => el.querySelector(s) as T;
  const type = (value: string) => {
    const input = q<HTMLInputElement>('[data-testid=dni-input]');
    input.value = value;
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  };
  const primary = () => {
    q<HTMLButtonElement>('[data-testid=dni-primary]').click();
    fixture.detectChanges();
  };
  const secondary = () => {
    q<HTMLButtonElement>('[data-testid=dni-secondary]').click();
    fixture.detectChanges();
  };
  const error = () => q('[data-testid=dni-error]')?.textContent?.trim() ?? null;

  it('muestra la ayuda y ningún error al inicio', () => {
    expect(el.textContent).toContain('Ayuda del panel');
    expect(error()).toBeNull();
  });

  it('campo vacío: obligatorio y no emite', () => {
    primary();
    expect(error()).toBe('Este campo es obligatorio.');
    expect(host.primaries).toEqual([]);
  });

  it.each(['1234567', '123456789', '1234abcd', '1234 678', 'abcdefgh'])(
    'DNI inválido "%s": error y no emite en ninguna de las dos acciones',
    (value) => {
      type(value);
      primary();
      secondary();
      expect(error()).toBe('El DNI debe tener 8 dígitos.');
      expect(host.primaries).toEqual([]);
      expect(host.secondaries).toEqual([]);
    },
  );

  it('DNI válido: emite el valor (recortado) por la acción pulsada', () => {
    type(' 12345678 ');
    primary();
    expect(host.primaries).toEqual(['12345678']);
    secondary();
    expect(host.secondaries).toEqual(['12345678']);
    expect(error()).toBeNull();
  });

  it('Enter en el campo ejecuta la acción principal', () => {
    type('12345678');
    q<HTMLInputElement>('[data-testid=dni-input]').dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Enter' }),
    );
    expect(host.primaries).toEqual(['12345678']);
  });

  it('con enterAction=secondary, Enter ejecuta la acción secundaria y no la principal', () => {
    host.enter.set('secondary');
    fixture.detectChanges();
    type('12345678');
    q<HTMLInputElement>('[data-testid=dni-input]').dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Enter' }),
    );
    expect(host.secondaries).toEqual(['12345678']);
    expect(host.primaries).toEqual([]);
  });

  it('el error se corrige al escribir un DNI válido y cada edición avisa al padre', () => {
    type('123');
    primary();
    expect(error()).not.toBeNull();
    type('12345678');
    expect(error()).toBeNull();
    expect(host.edits).toBe(2);
  });

  it('el error del servidor se muestra bajo el campo, con foco accesible', () => {
    host.fieldError.set('Este DNI no está vinculado a ninguna cuenta de SmartGym.');
    fixture.detectChanges();
    expect(error()).toBe('Este DNI no está vinculado a ninguna cuenta de SmartGym.');
    const input = q<HTMLInputElement>('[data-testid=dni-input]');
    expect(input.getAttribute('aria-invalid')).toBe('true');
    expect(input.getAttribute('aria-describedby')).toBe('dni-error');
    host.fieldError.set(null);
    fixture.detectChanges();
    expect(error()).toBeNull();
    expect(q('.form-text')).not.toBeNull();
  });

  it('con una acción en curso: ambos botones deshabilitados, indicador solo en esa y no emite', () => {
    type('12345678');
    host.busy.set('primary');
    fixture.detectChanges();
    expect(q<HTMLButtonElement>('[data-testid=dni-primary]').disabled).toBe(true);
    expect(q<HTMLButtonElement>('[data-testid=dni-secondary]').disabled).toBe(true);
    expect(q('[data-testid=dni-primary] .spinner-border')).not.toBeNull();
    expect(q('[data-testid=dni-secondary] .spinner-border')).toBeNull();
    q<HTMLInputElement>('[data-testid=dni-input]').dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Enter' }),
    );
    expect(host.primaries).toEqual([]);
    host.busy.set('secondary');
    fixture.detectChanges();
    expect(q('[data-testid=dni-secondary] .spinner-border')).not.toBeNull();
  });
});
