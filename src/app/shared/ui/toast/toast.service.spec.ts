import { TestBed } from '@angular/core/testing';
import {
  MAX_TOASTS,
  TOAST_DURATION_MS,
  TOAST_ERROR_DURATION_MS,
  ToastService,
} from './toast.service';

describe('ToastService', () => {
  let service: ToastService;

  beforeEach(() => {
    vi.useFakeTimers();
    service = TestBed.inject(ToastService);
  });

  afterEach(() => vi.useRealTimers());

  it('agrega toasts de cada tipo con título por defecto', () => {
    service.success('a');
    service.error('b');
    service.warning('c');
    service.info('d', 'Título propio');
    expect(service.toasts().map((t) => t.kind)).toEqual(['success', 'error', 'warning', 'info']);
    expect(service.toasts()[0].title).toBe('Listo');
    expect(service.toasts()[3].title).toBe('Título propio');
  });

  it('se cierra solo a los 5 s (7 s los errores)', () => {
    service.success('ok');
    service.error('mal');

    vi.advanceTimersByTime(TOAST_DURATION_MS - 1);
    expect(service.toasts()).toHaveLength(2);

    vi.advanceTimersByTime(1);
    expect(service.toasts().map((t) => t.kind)).toEqual(['error']);

    vi.advanceTimersByTime(TOAST_ERROR_DURATION_MS - TOAST_DURATION_MS);
    expect(service.toasts()).toHaveLength(0);
  });

  it('apila como máximo 4 y descarta los más antiguos', () => {
    for (let i = 1; i <= 6; i++) service.info(`m${i}`);
    expect(MAX_TOASTS).toBe(4);
    expect(service.toasts().map((t) => t.message)).toEqual(['m3', 'm4', 'm5', 'm6']);
  });

  it('dismiss cierra uno a mano y cancela su temporizador', () => {
    const id = service.info('uno');
    service.info('dos');
    service.dismiss(id);
    expect(service.toasts().map((t) => t.message)).toEqual(['dos']);
    expect(vi.getTimerCount()).toBe(1);
  });

  it('dismiss de un id inexistente no falla', () => {
    service.info('uno');
    service.dismiss(999);
    expect(service.toasts()).toHaveLength(1);
  });

  it('un aviso idéntico ya visible no se repite y reinicia su tiempo', () => {
    vi.useFakeTimers();
    const first = service.error('El servicio no está disponible.', 'Servicio no disponible');
    vi.advanceTimersByTime(5000);
    const second = service.error('El servicio no está disponible.', 'Servicio no disponible');
    expect(second).toBe(first);
    expect(service.toasts()).toHaveLength(1);
    vi.advanceTimersByTime(3000); // 8 s desde el primero: sigue porque el tiempo se reinició a los 5 s
    expect(service.toasts()).toHaveLength(1);
    vi.advanceTimersByTime(4100);
    expect(service.toasts()).toHaveLength(0);
    vi.useRealTimers();
  });

  it('avisos con distinto tipo, título o mensaje sí se apilan', () => {
    service.error('Mismo texto');
    service.warning('Mismo texto');
    service.error('Mismo texto', 'Otro título');
    service.error('Otro texto');
    expect(service.toasts()).toHaveLength(4);
  });
});
