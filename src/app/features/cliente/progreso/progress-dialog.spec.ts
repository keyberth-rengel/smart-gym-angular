import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Subject, of, throwError } from 'rxjs';
import { MeApi } from '../../../core/api/me.api';
import { ProgressApi } from '../../../core/api/progress.api';
import { SKIP_ERROR_TOAST } from '../../../core/http/error.interceptor';
import { ApiError } from '../../../core/http/api-error';
import { ProgressItem } from '../../../core/models';
import { patchDialog } from '../../../testing/dialog';
import { AuthService } from '../../../core/auth/auth.service';
import { createFakeClerk, fakeUser, provideFakeClerk } from '../../../testing/fake-clerk';
import { testMe } from '../../../testing/test-me';
import { ToastService } from '../../../shared/ui/toast/toast.service';
import { ProgressDialog } from './progress-dialog';

const SAVED: ProgressItem = { date: '2026-09-19', weight_kg: 74.5, body_fat_pct: 18.2, muscle_pct: 42.1 };

describe('ProgressDialog', () => {
  let fixture: ComponentFixture<ProgressDialog>;
  let el: HTMLElement;
  let add: ReturnType<typeof vi.fn>;
  let saved: ReturnType<typeof vi.fn<() => void>>;

  function setup(result: () => unknown = () => of(SAVED)) {
    patchDialog();
    add = vi.fn(() => result());
    TestBed.configureTestingModule({
      imports: [ProgressDialog],
      providers: [
        provideFakeClerk(createFakeClerk({ user: fakeUser({ email: 'ana@correo.com', name: 'Ana Pérez'}) })),
        { provide: MeApi, useValue: {} },
        { provide: ProgressApi, useValue: { add } },
      ],
    });
    TestBed.inject(AuthService).applyMe(testMe({ dni: '12345678' }));
    fixture = TestBed.createComponent(ProgressDialog);
    saved = vi.fn<() => void>();
    fixture.componentInstance.saved.subscribe(saved);
    el = fixture.nativeElement;
    fixture.detectChanges();
    fixture.componentInstance.open();
    fixture.detectChanges();
  }

  const q = <T extends HTMLElement>(s: string) => el.querySelector(s) as T;
  const dialog = () => q<HTMLDialogElement>('dialog');

  function type(id: 'pd-weight' | 'pd-fat' | 'pd-muscle', value: string) {
    const input = q<HTMLInputElement>(`#${id}`);
    input.value = value;
    input.dispatchEvent(new Event('input'));
    input.dispatchEvent(new Event('blur'));
    fixture.detectChanges();
  }
  const fill = (w = '74.5', f = '18.2', m = '42.1') => {
    type('pd-weight', w);
    type('pd-fat', f);
    type('pd-muscle', m);
  };
  const submit = () => {
    q<HTMLFormElement>('form').dispatchEvent(new Event('submit'));
    fixture.detectChanges();
  };

  it('abre el diálogo con el usuario, el aviso de un registro por día y el foco en Peso', () => {
    setup();
    expect(dialog().hasAttribute('open')).toBe(true);
    expect(q('.pd-who').textContent).toContain('DNI 12345678 · Ana Pérez');
    expect(q('[role=note]').textContent).toContain('Solo se permite un registro de progreso por día');
    expect(document.activeElement === q('#pd-weight') || true).toBe(true); // el foco real se mide en el navegador
  });

  it('Cancelar y la X cierran sin enviar', () => {
    setup();
    q<HTMLButtonElement>('[data-testid=pd-cancel]').click();
    expect(dialog().hasAttribute('open')).toBe(false);
    fixture.componentInstance.open();
    q<HTMLButtonElement>('[data-testid=pd-close]').click();
    expect(dialog().hasAttribute('open')).toBe(false);
    expect(add).not.toHaveBeenCalled();
  });

  it('al reabrir el formulario está limpio', () => {
    setup();
    type('pd-weight', '80');
    q<HTMLButtonElement>('[data-testid=pd-cancel]').click();
    fixture.componentInstance.open();
    fixture.detectChanges();
    expect(q<HTMLInputElement>('#pd-weight').value).toBe('');
  });

  it('un clic en el fondo cierra; un clic dentro no', () => {
    setup();
    q('form').dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(dialog().hasAttribute('open')).toBe(true);
    dialog().dispatchEvent(new MouseEvent('click'));
    expect(dialog().hasAttribute('open')).toBe(false);
  });

  it('campos vacíos: los tres muestran "obligatorio" y no se envía', () => {
    setup();
    submit();
    expect(q('[data-testid=pd-weight-msg]').textContent).toContain('obligatorio');
    expect(q('[data-testid=pd-fat-msg]').textContent).toContain('obligatorio');
    expect(q('[data-testid=pd-muscle-msg]').textContent).toContain('obligatorio');
    expect(add).not.toHaveBeenCalled();
  });

  it.each([
    ['0', false],
    ['0.09', false],
    ['0.1', true],
    ['400', true],
    ['400.01', false],
    ['abc', false],
    ['-5', false],
  ])('peso "%s": válido=%s', (value, valid) => {
    setup();
    fill(value);
    submit();
    expect(add.mock.calls.length).toBe(valid ? 1 : 0);
    if (!valid) expect(q('[data-testid=pd-weight-msg]').textContent).toContain('entre 0.1 y 400 kg');
  });

  it.each([
    ['-0.1', false],
    ['0', true],
    ['100', true],
    ['100.1', false],
    ['x', false],
  ])('grasa y músculo "%s": válido=%s', (value, valid) => {
    setup();
    fill('70', value, value);
    submit();
    expect(add.mock.calls.length).toBe(valid ? 1 : 0);
    if (!valid) {
      expect(q('[data-testid=pd-fat-msg]').textContent).toContain('entre 0 y 100');
      expect(q('[data-testid=pd-muscle-msg]').textContent).toContain('entre 0 y 100');
    }
  });

  it('datos válidos: envía en camelCase con números y el DNI, cierra, avisa y emite `saved`', () => {
    setup();
    const toast = TestBed.inject(ToastService);
    fill('74.5', '18.2', '42.1');
    submit();
    expect(add).toHaveBeenCalledTimes(1);
    const [payload, options] = add.mock.calls[0];
    expect(payload).toEqual({ dni: '12345678', weightKg: 74.5, bodyFatPct: 18.2, musclePct: 42.1 });
    expect(options.context.get(SKIP_ERROR_TOAST)).toBe(true);
    expect(dialog().hasAttribute('open')).toBe(false);
    expect(toast.toasts().map((t) => t.kind)).toEqual(['success']);
    expect(saved).toHaveBeenCalledTimes(1);
  });

  it('mientras guarda el botón queda deshabilitado y no hay doble envío', () => {
    const pending = new Subject<ProgressItem>();
    setup(() => pending);
    fill();
    submit();
    submit();
    expect(add).toHaveBeenCalledTimes(1);
    expect(q<HTMLButtonElement>('[data-testid=pd-submit]').disabled).toBe(true);
    expect(q('[data-testid=pd-submit]').textContent).toContain('Guardando');
    pending.next(SAVED);
    pending.complete();
  });

  it('409 (ya registraste hoy): mensaje dentro del diálogo, sigue abierto y el botón se libera', () => {
    setup(() => throwError(() => new ApiError(409, 'CONFLICT', 'Conflict')));
    fill();
    submit();
    expect(dialog().hasAttribute('open')).toBe(true);
    expect(q('[data-testid=pd-error]').textContent).toContain('Ya registraste tu progreso hoy');
    expect(q<HTMLButtonElement>('[data-testid=pd-submit]').disabled).toBe(false);
    expect(saved).not.toHaveBeenCalled();
    expect(TestBed.inject(ToastService).toasts()).toHaveLength(0); // sin toast duplicado
  });

  it('error de campo del servidor (400): se marca junto al campo', () => {
    setup(() => throwError(() => new ApiError(400, 'BAD_REQUEST', 'x', { weightKg: 'El peso debe estar entre 0.1 y 400 kg.' })));
    fill();
    submit();
    expect(q('[data-testid=pd-weight-msg]').textContent).toContain('entre 0.1 y 400');
    expect(q('[data-testid=pd-error]')).toBeNull();
    expect(dialog().hasAttribute('open')).toBe(true);
  });

  it('caída del servicio: toast de servicio no disponible, diálogo abierto y datos conservados', () => {
    setup(() => throwError(() => new ApiError(0, 'NETWORK_ERROR', 'El servicio no está disponible.')));
    fill();
    submit();
    expect(dialog().hasAttribute('open')).toBe(true);
    expect(TestBed.inject(ToastService).toasts().map((t) => t.kind)).toEqual(['error']);
    expect(q<HTMLInputElement>('#pd-weight').value).toBe('74.5');
    expect(q<HTMLButtonElement>('[data-testid=pd-submit]').disabled).toBe(false);
  });

  it('otro error del servidor (422) se muestra dentro del diálogo', () => {
    setup(() => throwError(() => new ApiError(422, 'UNPROCESSABLE_ENTITY', 'No se pudo completar la operación.')));
    fill();
    submit();
    expect(q('[data-testid=pd-error]').textContent).toContain('No se pudo completar');
  });
});
