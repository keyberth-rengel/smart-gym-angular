import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Observable, Subject, of, throwError } from 'rxjs';
import { TrainersApi } from '../../../core/api/trainers.api';
import { ApiError } from '../../../core/http/api-error';
import { Invitation, InvitationStatus, Trainer, TrainerCreate, TrainerCreated } from '../../../core/models';
import { ToastService } from '../../../shared/ui/toast/toast.service';
import { AdminEntrenadores } from './entrenadores';

const err = (status: number, raw = '', fields: Record<string, string> = {}, msg = raw) =>
  new ApiError(status, `HTTP_${status}`, msg, fields, raw);

const LIST: Trainer[] = [
  { email: 'marco@x.com', name: 'Marco Vílchez', age: 29, specialty: 'Funcional' },
  { email: 'lucia@x.com', name: 'Lucía Paredes', age: 33, specialty: null },
];

const created = (t: TrainerCreate, status: InvitationStatus): TrainerCreated => ({
  email: t.email,
  name: t.name,
  age: t.age,
  specialty: t.specialty ?? null,
  dni: t.dni ?? null,
  invitation: { status, message: 'x' },
});

describe('AdminEntrenadores', () => {
  let fixture: ComponentFixture<AdminEntrenadores>;
  let el: HTMLElement;
  let list: ReturnType<typeof vi.fn<() => Observable<Trainer[]>>>;
  let create: ReturnType<typeof vi.fn<(t: TrainerCreate) => Observable<TrainerCreated>>>;
  let invite: ReturnType<typeof vi.fn<(email: string) => Observable<Invitation>>>;
  let toasts: ToastService;

  function setup(
    opts: {
      list?: () => Observable<Trainer[]>;
      create?: (t: TrainerCreate) => Observable<TrainerCreated>;
      invite?: (email: string) => Observable<Invitation>;
    } = {},
  ) {
    list = vi.fn(opts.list ?? (() => of(LIST)));
    create = vi.fn(opts.create ?? ((t: TrainerCreate) => of(created(t, 'INVITED'))));
    invite = vi.fn(opts.invite ?? (() => of({ status: 'INVITED' as const, message: 'ok' })));
    TestBed.configureTestingModule({
      imports: [AdminEntrenadores],
      providers: [{ provide: TrainersApi, useValue: { list, create, invite } }],
    });
    toasts = TestBed.inject(ToastService);
    fixture = TestBed.createComponent(AdminEntrenadores);
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
  const fillValid = (extra: { specialty?: string; dni?: string } = {}) => {
    fill('tr-name', ' Luis Ramírez ');
    fill('tr-email', 'luis@x.com');
    fill('tr-specialty', extra.specialty ?? '');
    fill('tr-age', '30');
    fill('tr-dni', extra.dni ?? '');
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
  const rowActions = () => qa('[data-testid=row-action]') as HTMLButtonElement[];
  const toastMessages = () => toasts.toasts().map((t) => `${t.kind}:${t.message}`);

  it('carga y lista los entrenadores ordenados con su especialidad (o guion)', () => {
    setup();
    expect(list).toHaveBeenCalledTimes(1);
    const rows = qa('[data-testid=registry-row]').map((r) =>
      Array.from(r.querySelectorAll('td'))
        .map((td) => td.textContent!.trim())
        .slice(0, 4),
    );
    expect(rows).toEqual([
      ['Lucía Paredes', 'lucia@x.com', '—', '33'],
      ['Marco Vílchez', 'marco@x.com', 'Funcional', '29'],
    ]);
    expect(q('[data-testid=submit]').textContent).toContain('Registrar e invitar');
    expect(el.textContent).toContain('Se envía una invitación por correo con el rol Entrenador.');
  });

  it('error al listar: Reintentar recarga', () => {
    setup({ list: () => throwError(() => err(500)) });
    list.mockReturnValue(of(LIST));
    q<HTMLButtonElement>('[data-testid=retry]').click();
    fixture.detectChanges();
    expect(list).toHaveBeenCalledTimes(2);
    expect(qa('[data-testid=registry-row]')).toHaveLength(2);
  });

  describe('validaciones (no envían nada)', () => {
    beforeEach(() => setup());

    it('vacío: nombre, correo y edad obligatorios; especialidad y DNI opcionales', () => {
      submit();
      expect(create).not.toHaveBeenCalled();
      expect(error('name')).toBe('Este campo es obligatorio.');
      expect(error('email')).toBe('Este campo es obligatorio.');
      expect(error('age')).toBe('Este campo es obligatorio.');
      expect(q('[data-testid=dni-error]').hidden).toBe(true);
      expect(q('[data-testid=specialty-error]').hidden).toBe(true);
    });

    it('correo, edad, nombre, especialidad larga y DNI inválidos', () => {
      fillValid();
      fill('tr-email', 'x');
      fill('tr-age', '-1');
      fill('tr-name', 'A<');
      fill('tr-specialty', 'x'.repeat(81));
      fill('tr-dni', '123');
      submit();
      expect(create).not.toHaveBeenCalled();
      expect(error('email')).toBe('Ingresa un correo válido.');
      expect(error('age')).toBe('Debe ser mayor o igual a 0.');
      expect(error('name')).toBe('No puede contener los caracteres < o >.');
      expect(error('specialty')).toBe('Máximo 80 caracteres.');
      expect(error('dni')).toBe('El DNI debe tener 8 dígitos.');
    });
  });

  describe('registrar e invitar', () => {
    it('sin especialidad ni DNI: no envía esas claves', () => {
      setup();
      fillValid();
      submit();
      expect(create.mock.calls[0][0]).toEqual({ name: 'Luis Ramírez', email: 'luis@x.com', age: 30 });
      const body = create.mock.calls[0][0];
      expect('specialty' in body).toBe(false);
      expect('dni' in body).toBe(false);
    });

    it('con especialidad y DNI: los envía', () => {
      setup();
      fillValid({ specialty: 'Cardio', dni: '87654321' });
      submit();
      expect(create.mock.calls[0][0]).toEqual({
        name: 'Luis Ramírez',
        email: 'luis@x.com',
        age: 30,
        specialty: 'Cardio',
        dni: '87654321',
      });
    });

    it('INVITED: toast de éxito, sin aviso persistente, limpia y recarga', async () => {
      setup();
      fillValid();
      submit();
      await flush();
      expect(toastMessages()).toEqual(['success:Entrenador registrado. Invitación enviada por correo.']);
      expect(q('[data-testid=invitation-notice]')).toBeNull();
      expect(q<HTMLInputElement>('#tr-name').value).toBe('');
      expect(list).toHaveBeenCalledTimes(2);
    });

    it('ROLE_UPDATED: toast de éxito con la indicación de cerrar y abrir sesión', async () => {
      setup({ create: (t) => of(created(t, 'ROLE_UPDATED')) });
      fillValid();
      submit();
      await flush();
      expect(toasts.toasts()[0].kind).toBe('success');
      expect(toasts.toasts()[0].message).toContain('debe cerrar y abrir sesión');
    });

    it('SKIPPED: aviso ámbar persistente, sin toast; se limpia al enviar de nuevo', async () => {
      setup({ create: (t) => of(created(t, 'SKIPPED')) });
      fillValid();
      submit();
      await flush();
      const notice = q('[data-testid=invitation-notice]');
      expect(notice.classList).toContain('alert-warning');
      expect(notice.textContent).toContain('las invitaciones no están configuradas en el servidor');
      expect(toasts.toasts()).toHaveLength(0);

      create.mockReturnValue(of(created({ email: 'a@x.com', name: 'A', age: 1 }, 'INVITED')));
      fillValid();
      submit();
      await flush();
      expect(q('[data-testid=invitation-notice]')).toBeNull();
    });

    it('FAILED: aviso rojo persistente y el entrenador queda registrado (tabla recargada)', async () => {
      setup({ create: (t) => of(created(t, 'FAILED')) });
      fillValid();
      submit();
      await flush();
      const notice = q('[data-testid=invitation-notice]');
      expect(notice.classList).toContain('alert-danger');
      expect(notice.textContent).toContain('no se pudo enviar la invitación');
      expect(list).toHaveBeenCalledTimes(2);
    });

    it('sin doble envío', () => {
      const pending = new Subject<TrainerCreated>();
      setup({ create: () => pending });
      fillValid();
      submit();
      q<HTMLFormElement>('form').dispatchEvent(new Event('submit'));
      expect(create).toHaveBeenCalledTimes(1);
      expect(q<HTMLButtonElement>('[data-testid=submit]').disabled).toBe(true);
    });
  });

  describe('errores del alta', () => {
    it('409 DNI ajeno: error en el DNI, no se recarga la tabla (no se creó)', async () => {
      setup({
        create: () =>
          throwError(() => err(409, 'DNI already linked to another account', {}, 'Este DNI ya está vinculado a otra cuenta.')),
      });
      fillValid({ dni: '12345678' });
      submit();
      await flush();
      expect(error('dni')).toBe('Este DNI ya está vinculado a otra cuenta.');
      expect(list).toHaveBeenCalledTimes(1);
      expect(toasts.toasts()).toHaveLength(0);
    });

    it('409 correo repetido: error en el correo', async () => {
      setup({
        create: () => throwError(() => err(409, 'Trainer already exists: luis@x.com', {}, 'Ya existe un entrenador con ese correo.')),
      });
      fillValid();
      submit();
      await flush();
      expect(error('email')).toBe('Ya existe un entrenador con ese correo.');
    });

    it('400 con detalles por campo', async () => {
      setup({ create: () => throwError(() => err(400, 'Validation failed', { specialty: 'Máximo 80 caracteres.' })) });
      fillValid();
      submit();
      await flush();
      expect(error('specialty')).toBe('Máximo 80 caracteres.');
    });

    it('500: toast, datos conservados y botón libre', async () => {
      setup({ create: () => throwError(() => err(500, 'Unexpected error', {}, 'El servicio no está disponible.')) });
      fillValid();
      submit();
      await flush();
      expect(toasts.toasts()[0].title).toBe('Servicio no disponible');
      expect(q<HTMLInputElement>('#tr-email').value).toBe('luis@x.com');
      expect(q<HTMLButtonElement>('[data-testid=submit]').disabled).toBe(false);
    });
  });

  describe('reenviar invitación', () => {
    it('hay un botón por fila con etiqueta accesible y envía el correo de esa fila', async () => {
      setup();
      const buttons = rowActions();
      expect(buttons).toHaveLength(2);
      expect(buttons[0].getAttribute('aria-label')).toBe('Reenviar invitación a Lucía Paredes');
      buttons[0].click();
      await flush();
      expect(invite).toHaveBeenCalledWith('lucia@x.com', expect.anything());
      expect(toastMessages()).toEqual(['success:Invitación enviada a lucia@x.com.']);
    });

    it('ROLE_UPDATED, SKIPPED y FAILED: cada uno con su toast', async () => {
      setup({ invite: () => of({ status: 'ROLE_UPDATED', message: 'x' }) });
      rowActions()[0].click();
      await flush();
      expect(toasts.toasts()[0].kind).toBe('success');
      expect(toasts.toasts()[0].message).toContain('ya tenía cuenta');

      invite.mockReturnValue(of({ status: 'SKIPPED', message: 'clerk_not_configured' }));
      rowActions()[0].click();
      await flush();
      expect(toasts.toasts().at(-1)!.kind).toBe('warning');

      invite.mockReturnValue(of({ status: 'FAILED', message: 'x' }));
      rowActions()[0].click();
      await flush();
      expect(toasts.toasts().at(-1)!.kind).toBe('error');
    });

    it('doble clic: una sola petición y el botón queda deshabilitado hasta responder', async () => {
      const pending = new Subject<Invitation>();
      setup({ invite: () => pending });
      const button = rowActions()[0];
      button.click();
      fixture.detectChanges();
      expect(rowActions()[0].disabled).toBe(true);
      rowActions()[0].click();
      expect(invite).toHaveBeenCalledTimes(1);
      pending.next({ status: 'INVITED', message: 'ok' });
      pending.complete();
      await flush();
      expect(rowActions()[0].disabled).toBe(false);
    });

    it('404: avisa que el entrenador ya no existe y recarga la tabla', async () => {
      setup({ invite: () => throwError(() => err(404, 'Trainer not found', {}, 'No encontramos un entrenador con esos datos.')) });
      rowActions()[0].click();
      await flush();
      expect(toastMessages()).toEqual(['warning:El entrenador ya no existe.']);
      expect(list).toHaveBeenCalledTimes(2);
    });

    it('500: toast de servicio no disponible y el botón se libera', async () => {
      setup({ invite: () => throwError(() => err(500, 'Unexpected error', {}, 'El servicio no está disponible.')) });
      rowActions()[0].click();
      await flush();
      expect(toasts.toasts()[0].title).toBe('Servicio no disponible');
      expect(rowActions()[0].disabled).toBe(false);
    });
  });
});
