import { HttpContext } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Observable, Subject, of, throwError } from 'rxjs';
import { AttendanceApi } from '../../../core/api/attendance.api';
import { ApiError } from '../../../core/http/api-error';
import { SKIP_ERROR_TOAST } from '../../../core/http/error.interceptor';
import { AttendanceRecord } from '../../../core/models';
import { AdminAsistencia } from './asistencia';

const err = (status: number, raw = '') => new ApiError(status, `HTTP_${status}`, raw, {}, raw);
const NOT_LINKED = 'Este DNI no está vinculado a ninguna cuenta de SmartGym.';
const DNI = '74582136';
const WELCOME = 'Welcome Carlos Mendoza! Access recorded for carlos@x.com.';
const RECORDS: AttendanceRecord[] = [
  { id: 1, email: 'carlos@x.com', role: 'CUSTOMER', timestamp: '2026-09-15T07:05:00' },
  { id: 2, email: 'carlos@x.com', role: 'CUSTOMER', timestamp: '2026-09-19T06:45:00' },
  { id: 3, email: 'lucia@x.com', role: 'TRAINER', timestamp: '2026-09-17T18:20:00' },
];

describe('AdminAsistencia', () => {
  let fixture: ComponentFixture<AdminAsistencia>;
  let el: HTMLElement;
  let access: ReturnType<typeof vi.fn<(dni: string, ctx?: HttpContext) => Observable<string>>>;
  let list: ReturnType<
    typeof vi.fn<(dni: string, ctx?: HttpContext) => Observable<AttendanceRecord[]>>
  >;

  function setup(
    o: {
      access?: (dni: string) => Observable<string>;
      list?: (dni: string) => Observable<AttendanceRecord[]>;
    } = {},
  ) {
    access = vi.fn((dni: string, _ctx?: HttpContext) => (o.access ?? (() => of(WELCOME)))(dni));
    list = vi.fn((dni: string, _ctx?: HttpContext) => (o.list ?? (() => of(RECORDS)))(dni));
    TestBed.configureTestingModule({
      imports: [AdminAsistencia],
      providers: [{ provide: AttendanceApi, useValue: { access, list } }],
    });
    fixture = TestBed.createComponent(AdminAsistencia);
    el = fixture.nativeElement;
    fixture.detectChanges();
  }

  const q = <T extends HTMLElement>(s: string) => el.querySelector(s) as T;
  const qa = (s: string) => Array.from(el.querySelectorAll<HTMLElement>(s));
  const flush = async () => {
    await fixture.whenStable();
    await new Promise((r) => setTimeout(r));
    fixture.detectChanges();
  };
  const type = (value: string) => {
    const input = q<HTMLInputElement>('[data-testid=dni-input]');
    input.value = value;
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  };
  const register = async (dni = DNI) => {
    type(dni);
    q<HTMLButtonElement>('[data-testid=dni-primary]').click();
    await flush();
  };
  const viewHistory = async (dni = DNI) => {
    type(dni);
    q<HTMLButtonElement>('[data-testid=dni-secondary]').click();
    await flush();
  };
  const fieldError = () => q('[data-testid=dni-error]')?.textContent?.trim() ?? null;
  const failure = () => q('[data-testid=failure]')?.textContent?.trim() ?? null;
  const success = () => q('[data-testid=access-success]')?.textContent?.trim() ?? null;
  const rowsText = () =>
    qa('[data-testid=history-row]').map((r) =>
      Array.from(r.querySelectorAll('td'))
        .map((td) => td.textContent!.trim())
        .join(' '),
    );

  it('al entrar: estado inicial y ninguna llamada', () => {
    setup();
    expect(el.textContent).toContain('Registra un ingreso o consulta un historial');
    expect(access).not.toHaveBeenCalled();
    expect(list).not.toHaveBeenCalled();
  });

  it('DNI inválido o vacío: no llama al API en ninguna acción', async () => {
    setup();
    await register('');
    await register('1234567');
    await viewHistory('123456789');
    await viewHistory('1234abcd');
    expect(access).not.toHaveBeenCalled();
    expect(list).not.toHaveBeenCalled();
  });

  describe('registrar ingreso', () => {
    it('avisa en español con nombre y correo y muestra el historial del mismo DNI', async () => {
      setup();
      await register();
      expect(access).toHaveBeenCalledTimes(1);
      expect(access.mock.calls[0][0]).toBe(DNI);
      expect(success()).toBe('¡Bienvenido Carlos Mendoza! Ingreso registrado para carlos@x.com.');
      expect(list).toHaveBeenCalledWith(DNI, expect.anything());
      expect(q('#history-title').textContent).toContain(`DNI ${DNI}`);
      expect(q('[data-testid=count]').textContent).toBe('3');
    });

    it('el historial va más reciente primero con rol Cliente (azul) y Entrenador (verde)', async () => {
      setup();
      await register();
      expect(rowsText()).toEqual([
        '19 sep 2026 06:45 carlos@x.com Cliente',
        '17 sep 2026 18:20 lucia@x.com Entrenador',
        '15 sep 2026 07:05 carlos@x.com Cliente',
      ]);
      const tones = qa('[data-testid=history-row] .sg-badge').map((b) => b.className);
      expect(tones[0]).toContain('sg-badge-blue');
      expect(tones[1]).toContain('sg-badge-green');
    });

    it('texto de bienvenida inesperado: mensaje genérico', async () => {
      setup({ access: () => of('Hola') });
      await register();
      expect(success()).toBe('Ingreso registrado correctamente.');
    });

    it('DNI no vinculado (404): error de campo, sin éxito ni historial', async () => {
      setup({ access: () => throwError(() => err(404, 'DNI not linked')) });
      await register();
      expect(fieldError()).toBe(NOT_LINKED);
      expect(success()).toBeNull();
      expect(list).not.toHaveBeenCalled();
    });

    it('vínculo sin perfil (Identity not recognized): aviso general', async () => {
      setup({
        access: () => throwError(() => err(404, 'Identity not recognized for the linked email')),
      });
      await register();
      expect(failure()).toContain('sin perfil de cliente ni de entrenador');
      expect(fieldError()).toBeNull();
    });

    it('500 o 403: sin éxito (el toast lo pone el interceptor), sin historial y botón libre', async () => {
      setup({ access: () => throwError(() => err(500)) });
      await register();
      expect(success()).toBeNull();
      expect(list).not.toHaveBeenCalled();
      expect(q<HTMLButtonElement>('[data-testid=dni-primary]').disabled).toBe(false);
    });

    it('doble clic: un solo POST y botones deshabilitados durante el envío', async () => {
      const gate = new Subject<string>();
      setup({ access: () => gate });
      type(DNI);
      const btn = q<HTMLButtonElement>('[data-testid=dni-primary]');
      btn.click();
      btn.click();
      await flush();
      expect(access).toHaveBeenCalledTimes(1);
      expect(btn.disabled).toBe(true);
      expect(q<HTMLButtonElement>('[data-testid=dni-secondary]').disabled).toBe(true);
      gate.next(WELCOME);
      gate.complete();
      await flush();
      expect(access).toHaveBeenCalledTimes(1);
      expect(btn.disabled).toBe(false);
    });

    it('registrar dos veces refresca el historial cada vez', async () => {
      setup();
      await register();
      await register();
      expect(access).toHaveBeenCalledTimes(2);
      expect(list).toHaveBeenCalledTimes(2);
    });
  });

  describe('ver historial', () => {
    it('lista sin avisar de bienvenida y consulta sin toast automático', async () => {
      setup();
      await viewHistory();
      expect(access).not.toHaveBeenCalled();
      expect(list.mock.calls[0][1]!.get(SKIP_ERROR_TOAST)).toBe(true);
      expect(success()).toBeNull();
      expect(rowsText()).toHaveLength(3);
    });

    it('un solo ingreso: singular', async () => {
      setup({ list: () => of([RECORDS[0]]) });
      await viewHistory();
      expect(q('app-badge')!.textContent!.replace(/\s+/g, ' ').trim()).toBe('1 ingreso');
    });

    it('sin ingresos: estado vacío', async () => {
      setup({ list: () => of([]) });
      await viewHistory();
      expect(el.textContent).toContain('Sin ingresos registrados');
      expect(q('[data-testid=history-table]')).toBeNull();
    });

    it('DNI no vinculado (404): error de campo y sin tabla', async () => {
      setup({ list: () => throwError(() => err(404, 'DNI not linked')) });
      await viewHistory();
      expect(fieldError()).toBe(NOT_LINKED);
      expect(q('[data-testid=history-table]')).toBeNull();
      expect(el.textContent).toContain('Registra un ingreso o consulta un historial');
    });

    it('un DNI no vinculado limpia el historial anterior', async () => {
      setup();
      await viewHistory();
      expect(rowsText()).toHaveLength(3);
      list.mockReturnValue(throwError(() => err(404, 'DNI not linked')));
      await viewHistory('11111111');
      expect(q('[data-testid=history-table]')).toBeNull();
      expect(fieldError()).toBe(NOT_LINKED);
    });

    it('500: error con Reintentar que vuelve a consultar el mismo DNI', async () => {
      setup({ list: () => throwError(() => err(500)) });
      await viewHistory();
      expect(el.textContent).toContain('No pudimos cargar el historial');
      list.mockReturnValue(of(RECORDS));
      q<HTMLButtonElement>('[data-testid=retry]').click();
      await flush();
      expect(list).toHaveBeenLastCalledWith(DNI, expect.anything());
      expect(rowsText()).toHaveLength(3);
    });

    it('403: aviso de permisos y estado de error', async () => {
      setup({ list: () => throwError(() => err(403)) });
      await viewHistory();
      expect(failure()).toBe('No tienes permisos para consultar la asistencia.');
      expect(q('[data-testid=retry]')).not.toBeNull();
    });

    it('mientras carga: esqueleto', async () => {
      setup({ list: () => new Subject<AttendanceRecord[]>() });
      type(DNI);
      q<HTMLButtonElement>('[data-testid=dni-secondary]').click();
      fixture.detectChanges();
      expect(q('[data-testid=loading-table]')).not.toBeNull();
    });
  });
});
