import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Observable, Subject, of, throwError } from 'rxjs';
import { CustomersApi } from '../../../core/api/customers.api';
import { ApiError } from '../../../core/http/api-error';
import { Customer, CustomerCreate } from '../../../core/models';
import { ToastService } from '../../../shared/ui/toast/toast.service';
import { AdminClientes } from './clientes';

const err = (status: number, raw = '', fields: Record<string, string> = {}, msg = raw) =>
  new ApiError(status, `HTTP_${status}`, msg, fields, raw);

const LIST: Customer[] = [
  { email: 'rosa@x.com', name: 'Rosa Lima', age: 34 },
  { email: 'carlos@x.com', name: 'Carlos Mendoza', age: 28 },
];

describe('AdminClientes', () => {
  let fixture: ComponentFixture<AdminClientes>;
  let el: HTMLElement;
  let list: ReturnType<typeof vi.fn<() => Observable<Customer[]>>>;
  let create: ReturnType<typeof vi.fn<(c: CustomerCreate) => Observable<Customer>>>;
  let toasts: ToastService;

  function setup(
    opts: {
      list?: () => Observable<Customer[]>;
      create?: (c: CustomerCreate) => Observable<Customer>;
    } = {},
  ) {
    list = vi.fn(opts.list ?? (() => of(LIST)));
    create = vi.fn(opts.create ?? ((c: CustomerCreate) => of({ email: c.email, name: c.name, age: c.age })));
    TestBed.configureTestingModule({
      imports: [AdminClientes],
      providers: [{ provide: CustomersApi, useValue: { list, create } }],
    });
    toasts = TestBed.inject(ToastService);
    fixture = TestBed.createComponent(AdminClientes);
    el = fixture.nativeElement;
    fixture.detectChanges();
  }

  const q = <T extends HTMLElement>(s: string) => el.querySelector(s) as T;
  const qa = (s: string) => Array.from(el.querySelectorAll<HTMLElement>(s));
  const fill = (id: string, value: string) => {
    const input = q<HTMLInputElement>(`#${id}`);
    input.value = value;
    input.dispatchEvent(new Event('input'));
  };
  const fillValid = (dni = '') => {
    fill('cl-name', '  Ana Torres ');
    fill('cl-email', 'ana@x.com');
    fill('cl-age', '28');
    fill('cl-dni', dni);
  };
  const submit = () => {
    q<HTMLButtonElement>('[data-testid=submit]').click();
    fixture.detectChanges();
  };
  const flush = async () => {
    await fixture.whenStable();
    fixture.detectChanges();
  };
  const error = (k: string) => q(`[data-testid=${k}-error]`).textContent!.trim();
  const rowNames = () =>
    qa('[data-testid=registry-row]').map((r) => r.querySelector('td')!.textContent!.trim());
  const toastMessages = () => toasts.toasts().map((t) => `${t.kind}:${t.message}`);

  it('carga los clientes al entrar y los lista ordenados por nombre', () => {
    setup();
    expect(list).toHaveBeenCalledTimes(1);
    expect(rowNames()).toEqual(['Carlos Mendoza', 'Rosa Lima']);
    expect(q('[data-testid=total]').textContent).toBe('2');
    expect(el.textContent).toContain('Se crea el cliente y se vincula su DNI');
  });

  it('sin clientes: estado vacío; con error: aviso y Reintentar vuelve a pedir la lista', () => {
    setup({ list: () => of([]) });
    expect(q('[data-testid=empty-state]')).not.toBeNull();
    TestBed.resetTestingModule();

    setup({ list: () => throwError(() => err(500)) });
    expect(q('[data-testid=retry]')).not.toBeNull();
    list.mockReturnValue(of(LIST));
    q<HTMLButtonElement>('[data-testid=retry]').click();
    fixture.detectChanges();
    expect(list).toHaveBeenCalledTimes(2);
    expect(rowNames()).toHaveLength(2);
  });

  it('403 al listar (no es admin): error con Reintentar', () => {
    setup({ list: () => throwError(() => err(403, 'Forbidden', {}, 'Sin permisos')) });
    expect(q('[data-testid=retry]')).not.toBeNull();
    expect(q('[data-testid=registry-table]')).toBeNull();
    expect(el.textContent).toContain('No tienes permisos para ver esta sección.');
    expect(el.textContent).not.toContain('Revisa tu conexión');
  });

  it('un 500 al listar habla de la conexión (no de permisos)', () => {
    setup({ list: () => throwError(() => err(500)) });
    expect(el.textContent).toContain('Revisa tu conexión');
    expect(el.textContent).not.toContain('No tienes permisos para ver esta sección.');
  });

  describe('validaciones (no envían nada)', () => {
    beforeEach(() => setup());

    it('formulario vacío: obligatorios, sin llamada al API', () => {
      submit();
      expect(create).not.toHaveBeenCalled();
      expect(error('name')).toBe('Este campo es obligatorio.');
      expect(error('email')).toBe('Este campo es obligatorio.');
      expect(error('age')).toBe('Este campo es obligatorio.');
      expect(q('[data-testid=dni-error]').hidden).toBe(true); // el DNI es opcional
    });

    it('correo inválido', () => {
      fillValid();
      fill('cl-email', 'sin-arroba');
      submit();
      expect(create).not.toHaveBeenCalled();
      expect(error('email')).toBe('Ingresa un correo válido.');
    });

    it.each([
      ['-3', 'Debe ser mayor o igual a 0.'],
      ['121', 'Debe ser menor o igual a 120.'],
      ['abc', 'Ingresa un número entero.'],
      ['28.5', 'Ingresa un número entero.'],
    ])('edad %s', (value, message) => {
      fillValid();
      fill('cl-age', value);
      submit();
      expect(create).not.toHaveBeenCalled();
      expect(error('age')).toBe(message);
    });

    it('la edad 0 y 120 son válidas (bordes)', () => {
      fillValid();
      fill('cl-age', '0');
      submit();
      expect(create).toHaveBeenCalledTimes(1);
    });

    it('nombre con < o > y de más de 120 caracteres', () => {
      fillValid();
      fill('cl-name', 'Ana <b>');
      submit();
      expect(error('name')).toBe('No puede contener los caracteres < o >.');
      fill('cl-name', 'x'.repeat(121));
      submit();
      expect(error('name')).toBe('Máximo 120 caracteres.');
      expect(create).not.toHaveBeenCalled();
    });

    it.each(['1234567', '123456789', '1234abcd', '12 45678'])('DNI %s', (dni) => {
      fillValid(dni);
      submit();
      expect(create).not.toHaveBeenCalled();
      expect(error('dni')).toBe('El DNI debe tener 8 dígitos.');
    });
  });

  describe('registrar', () => {
    it('sin DNI: envía los datos recortados sin la clave dni, avisa, limpia y recarga la tabla', async () => {
      setup();
      fillValid();
      submit();
      await flush();
      expect(create.mock.calls[0][0]).toEqual({ name: 'Ana Torres', email: 'ana@x.com', age: 28 });
      expect('dni' in create.mock.calls[0][0]).toBe(false);
      expect(toastMessages()).toEqual(['success:Cliente Ana Torres registrado.']);
      expect(q<HTMLInputElement>('#cl-name').value).toBe('');
      expect(q<HTMLInputElement>('#cl-age').value).toBe('');
      expect(list).toHaveBeenCalledTimes(2);
    });

    it('con DNI: lo envía', () => {
      setup();
      fillValid('12345678');
      submit();
      expect(create.mock.calls[0][0]).toEqual({
        name: 'Ana Torres',
        email: 'ana@x.com',
        age: 28,
        dni: '12345678',
      });
    });

    it('sin doble envío: mientras se registra el botón está deshabilitado', () => {
      const pending = new Subject<Customer>();
      setup({ create: () => pending });
      fillValid();
      submit();
      expect(q<HTMLButtonElement>('[data-testid=submit]').disabled).toBe(true);
      q<HTMLFormElement>('form').dispatchEvent(new Event('submit'));
      fixture.detectChanges();
      expect(create).toHaveBeenCalledTimes(1);
      pending.next({ email: 'ana@x.com', name: 'Ana Torres', age: 28 });
      pending.complete();
      fixture.detectChanges();
      expect(q<HTMLButtonElement>('[data-testid=submit]').disabled).toBe(false);
    });
  });

  describe('errores del servidor', () => {
    it('409 correo repetido: error junto al correo, sin toast y sin limpiar el formulario', async () => {
      setup({
        create: () =>
          throwError(() =>
            err(409, 'Customer already exists: ana@x.com', {}, 'Ya existe un cliente con ese correo.'),
          ),
      });
      fillValid();
      submit();
      await flush();
      expect(error('email')).toBe('Ya existe un cliente con ese correo.');
      expect(toasts.toasts()).toHaveLength(0);
      expect(q<HTMLInputElement>('#cl-name').value).toBe('  Ana Torres ');
      expect(list).toHaveBeenCalledTimes(1);
    });

    it('409 DNI ya vinculado a otro correo: error junto al DNI', async () => {
      setup({
        create: () =>
          throwError(() =>
            err(409, 'DNI already linked to another account', {}, 'Este DNI ya está vinculado a otra cuenta.'),
          ),
      });
      fillValid('12345678');
      submit();
      await flush();
      expect(error('dni')).toBe('Este DNI ya está vinculado a otra cuenta.');
      expect(q('[data-testid=email-error]').hidden).toBe(true);
      expect(toasts.toasts()).toHaveLength(0);
    });

    it('400 con detalles por campo: cada mensaje junto a su campo', async () => {
      setup({
        create: () =>
          throwError(() => err(400, 'Validation failed', { name: 'Máximo 120 caracteres.', age: 'Debe ser mayor o igual a 0.' })),
      });
      fillValid();
      submit();
      await flush();
      expect(error('name')).toBe('Máximo 120 caracteres.');
      expect(error('age')).toBe('Debe ser mayor o igual a 0.');
      expect(toasts.toasts()).toHaveLength(0);
    });

    it('400 con un campo que el formulario no tiene: toast', async () => {
      setup({ create: () => throwError(() => err(400, 'Validation failed', { paymentMethod: 'x' })) });
      fillValid();
      submit();
      await flush();
      expect(toasts.toasts()).toHaveLength(1);
      expect(toasts.toasts()[0].kind).toBe('error');
    });

    it('500 y red caída: toast y el formulario conserva los datos y se libera', async () => {
      setup({ create: () => throwError(() => err(500, 'Unexpected error', {}, 'El servicio no está disponible.')) });
      fillValid('12345678');
      submit();
      await flush();
      expect(toasts.toasts()).toHaveLength(1);
      expect(toasts.toasts()[0].title).toBe('Servicio no disponible');
      expect(q<HTMLInputElement>('#cl-email').value).toBe('ana@x.com');
      expect(q<HTMLInputElement>('#cl-dni').value).toBe('12345678');
      expect(q<HTMLButtonElement>('[data-testid=submit]').disabled).toBe(false);

      create.mockReturnValue(throwError(() => new ApiError(0, 'NETWORK_ERROR', 'Sin conexión.')));
      submit();
      await flush();
      expect(toasts.toasts().length).toBeGreaterThanOrEqual(1);
      expect(q<HTMLInputElement>('#cl-email').value).toBe('ana@x.com');
    });

    it('403 (no es admin): toast de permisos', async () => {
      setup({ create: () => throwError(() => err(403, 'Forbidden', {}, 'No tienes permisos.')) });
      fillValid();
      submit();
      await flush();
      expect(toasts.toasts()[0].title).toBe('Sin permisos');
    });
  });

  it('la búsqueda filtra por nombre o correo sin acentos', () => {
    setup({
      list: () =>
        of([
          { email: 'maria@x.com', name: 'María López', age: 30 },
          { email: 'jose@x.com', name: 'José Pérez', age: 40 },
        ]),
    });
    const input = q<HTMLInputElement>('[data-testid=search]');
    input.value = 'MARIA';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(rowNames()).toEqual(['María López']);
  });
});
