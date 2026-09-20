import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { RegistryColumn, RegistryList, RegistryRow, RegistryStatus } from './registry-list';

const ROWS: RegistryRow[] = [
  { email: 'maria@x.com', name: 'María López', age: 30, specialty: null },
  { email: 'ana@x.com', name: 'Ana Torres', age: 22, specialty: 'Funcional' },
  { email: 'jose@x.com', name: 'José Ñuñez', age: 41, specialty: '' },
];
const COLUMNS: RegistryColumn[] = [
  { key: 'name', label: 'Nombre' },
  { key: 'email', label: 'Correo', muted: true, hideBelowLg: true },
  { key: 'specialty', label: 'Especialidad' },
  { key: 'age', label: 'Edad', end: true },
];

@Component({
  imports: [RegistryList],
  template: `
    <app-registry-list
      title="Personas"
      [columns]="columns"
      [rows]="rows()"
      [status]="status()"
      [forbidden]="forbidden()"
      [actionIcon]="action ? 'envelope' : undefined"
      [actionLabel]="label"
      [pending]="pending()"
      (retry)="retries = retries + 1"
      (action)="acted.push($event.email)"
    />
  `,
})
class Host {
  columns = COLUMNS;
  rows = signal<RegistryRow[]>(ROWS);
  status = signal<RegistryStatus>('ready');
  forbidden = signal(false);
  pending = signal<string[]>([]);
  action = false;
  retries = 0;
  acted: string[] = [];
  label = (r: RegistryRow) => `Reenviar a ${r.name}`;
}

describe('RegistryList', () => {
  let host: Host;
  let el: HTMLElement;
  let fixture: ReturnType<typeof TestBed.createComponent<Host>>;

  function setup(action = false) {
    fixture = TestBed.createComponent(Host);
    host = fixture.componentInstance;
    host.action = action;
    el = fixture.nativeElement;
    fixture.detectChanges();
  }
  const q = <T extends HTMLElement>(s: string) => el.querySelector(s) as T;
  const qa = (s: string) => Array.from(el.querySelectorAll<HTMLElement>(s));
  const names = () =>
    qa('[data-testid=registry-row]').map((r) => r.querySelector('td')!.textContent!.trim());
  const type = (value: string) => {
    const input = q<HTMLInputElement>('[data-testid=search]');
    input.value = value;
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  };

  it('lista ordenada por nombre y con el total', () => {
    setup();
    expect(names()).toEqual(['Ana Torres', 'José Ñuñez', 'María López']);
    expect(q('[data-testid=total]').textContent).toBe('3');
  });

  it('valores vacíos o nulos se muestran como guion y la columna correo se atenúa', () => {
    setup();
    const cells = qa('[data-testid=registry-row]')[2].querySelectorAll('td'); // María
    expect(cells[2].textContent!.trim()).toBe('—');
    expect(cells[1].classList).toContain('muted');
    expect(cells[3].classList).toContain('num');
  });

  it('busca sin distinguir acentos ni mayúsculas, por nombre o correo', () => {
    setup();
    type('NUNEZ');
    expect(names()).toEqual(['José Ñuñez']);
    type('ana@x');
    expect(names()).toEqual(['Ana Torres']);
  });

  it('sin resultados muestra el mensaje y "Limpiar búsqueda" restablece la lista', () => {
    setup();
    type('zzz');
    expect(q('[data-testid=no-results]').textContent).toContain('Sin resultados para «zzz»');
    expect(q('[data-testid=registry-table]')).toBeNull();
    q<HTMLButtonElement>('[data-testid=clear-search]').click();
    fixture.detectChanges();
    expect(names()).toHaveLength(3);
    expect(q<HTMLInputElement>('[data-testid=search]').value).toBe('');
  });

  it('vacío: estado vacío sin buscador', () => {
    setup();
    host.rows.set([]);
    fixture.detectChanges();
    expect(q('[data-testid=empty-state]')).not.toBeNull();
    expect(q('[data-testid=search]')).toBeNull();
  });

  it('cargando: esqueleto; error: Reintentar emite retry', () => {
    setup();
    host.status.set('loading');
    fixture.detectChanges();
    expect(q('[data-testid=loading-table]')).not.toBeNull();
    host.status.set('error');
    fixture.detectChanges();
    expect(q('[data-testid=registry-table]')).toBeNull();
    q<HTMLButtonElement>('[data-testid=retry]').click();
    expect(host.retries).toBe(1);
  });

  it('error de conexión: habla de la conexión; con 403: habla de permisos (y sigue el Reintentar)', () => {
    setup();
    host.status.set('error');
    fixture.detectChanges();
    expect(el.textContent).toContain('Revisa tu conexión e inténtalo de nuevo.');
    expect(el.textContent).not.toContain('No tienes permisos');
    expect(q('.bi-cloud-slash')).not.toBeNull();

    host.forbidden.set(true);
    fixture.detectChanges();
    expect(el.textContent).toContain('No tienes permisos para ver esta sección.');
    expect(el.textContent).not.toContain('Revisa tu conexión');
    expect(q('.bi-lock')).not.toBeNull();
    expect(q('[data-testid=retry]')).not.toBeNull();
  });

  it('sin actionIcon no hay columna de acción', () => {
    setup(false);
    expect(qa('[data-testid=row-action]')).toHaveLength(0);
  });

  it('con actionIcon: un botón por fila con etiqueta accesible que emite la fila', () => {
    setup(true);
    const buttons = qa('[data-testid=row-action]');
    expect(buttons).toHaveLength(3);
    expect(buttons[0].getAttribute('aria-label')).toBe('Reenviar a Ana Torres');
    buttons[0].click();
    expect(host.acted).toEqual(['ana@x.com']);
  });

  it('la fila con acción pendiente queda deshabilitada (sin doble envío)', () => {
    setup(true);
    host.pending.set(['ana@x.com']);
    fixture.detectChanges();
    const buttons = qa('[data-testid=row-action]') as HTMLButtonElement[];
    expect(buttons[0].disabled).toBe(true);
    expect(buttons[1].disabled).toBe(false);
    buttons[0].click();
    expect(host.acted).toEqual([]);
  });
});
