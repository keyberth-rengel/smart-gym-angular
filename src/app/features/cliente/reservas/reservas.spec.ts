import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Observable, Subject, of, throwError } from 'rxjs';
import { BookingsApi } from '../../../core/api/bookings.api';
import { MeApi } from '../../../core/api/me.api';
import { TrainersApi } from '../../../core/api/trainers.api';
import { AuthService } from '../../../core/auth/auth.service';
import { ApiError } from '../../../core/http/api-error';
import { Booking, BookingCreate, Trainer, TrainerAvailability } from '../../../core/models';
import { createFakeClerk, fakeUser, provideFakeClerk } from '../../../testing/fake-clerk';
import { testMe } from '../../../testing/test-me';
import { ToastService } from '../../../shared/ui/toast/toast.service';
import { ClienteReservas } from './reservas';

const TRAINERS: Trainer[] = [
  { email: 'lucia@smartgym.pe', name: 'Lucía Paredes', age: 33, specialty: 'Fuerza' },
  { email: 'marco@smartgym.pe', name: 'Marco Vílchez', age: 29, specialty: null },
];
const avail = (email: string, times: string[]): TrainerAvailability => ({
  date: '2026-09-19',
  booked_times: times,
});
const BOOKINGS: Booking[] = [
  {
    id: 1,
    customer_email: 'ana@correo.com',
    trainer_email: 'lucia@smartgym.pe',
    date: '2026-09-12',
    time: '17:00',
    note: null,
  },
  {
    id: 2,
    customer_email: 'ana@correo.com',
    trainer_email: 'marco@smartgym.pe',
    date: '2026-09-19',
    time: '18:30',
    note: 'Piernas',
  },
];
const err = (status: number, raw = '') => new ApiError(status, `HTTP_${status}`, raw, {}, raw);

describe('ClienteReservas', () => {
  let fixture: ComponentFixture<ClienteReservas>;
  let el: HTMLElement;
  let trainersList: ReturnType<typeof vi.fn<() => Observable<Trainer[]>>>;
  let availability: ReturnType<
    typeof vi.fn<(e: string, d?: string) => Observable<TrainerAvailability>>
  >;
  let create: ReturnType<typeof vi.fn<(b: BookingCreate) => Observable<Booking>>>;
  let list: ReturnType<typeof vi.fn<() => Observable<Booking[]>>>;
  let toasts: ToastService;

  function setup(
    o: {
      trainers?: () => Observable<Trainer[]>;
      availability?: (e: string) => Observable<TrainerAvailability>;
      create?: (b: BookingCreate) => Observable<Booking>;
      bookings?: () => Observable<Booking[]>;
    } = {},
  ) {
    trainersList = vi.fn(o.trainers ?? (() => of(TRAINERS)));
    availability = vi.fn((e: string) =>
      (o.availability ?? ((x: string) => of(avail(x, ['16:00', '18:00']))))(e),
    );
    create = vi.fn(
      o.create ??
        ((b: BookingCreate) => of({ id: 9, ...b, date: '2026-09-19', note: b.note ?? null })),
    );
    list = vi.fn(o.bookings ?? (() => of(BOOKINGS)));
    TestBed.configureTestingModule({
      imports: [ClienteReservas],
      providers: [
        provideFakeClerk(
          createFakeClerk({ user: fakeUser({ email: 'ana@correo.com', name: 'Ana Pérez' }) }),
        ),
        { provide: MeApi, useValue: {} },
        { provide: TrainersApi, useValue: { list: trainersList, availability } },
        { provide: BookingsApi, useValue: { create, list } },
      ],
    });
    TestBed.inject(AuthService).applyMe(testMe());
    toasts = TestBed.inject(ToastService);
    vi.spyOn(toasts, 'success');
    fixture = TestBed.createComponent(ClienteReservas);
    el = fixture.nativeElement;
    fixture.detectChanges();
  }

  const q = <T extends HTMLElement>(s: string) => el.querySelector(s) as T;
  const qa = (s: string) => Array.from(el.querySelectorAll<HTMLElement>(s));
  const text = (s: string) => q(s).textContent!.replace(/\s+/g, ' ').trim();
  const chips = () => qa('[data-testid=chip]') as HTMLButtonElement[];
  const chip = (t: string) => chips().find((c) => c.textContent!.trim() === t)!;

  function chooseTrainer(email: string) {
    const select = q<HTMLSelectElement>('[data-testid=trainer-select]');
    select.value = email;
    select.dispatchEvent(new Event('change'));
    fixture.detectChanges();
  }
  function type(value: string) {
    const ta = q<HTMLTextAreaElement>('[data-testid=note]');
    ta.value = value;
    ta.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  }
  function submit() {
    q<HTMLButtonElement>('[data-testid=submit]').click();
    fixture.detectChanges();
  }

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 8, 19, 15, 10)); // sábado 15:10
  });
  afterEach(() => vi.useRealTimers());

  it('carga entrenadores en el select con su especialidad y muestra la fecha de hoy', () => {
    setup();
    const opts = qa('[data-testid=trainer-select] option').map((o) =>
      o.textContent!.replace(/\s+/g, ' ').trim(),
    );
    expect(opts).toEqual(['Selecciona un entrenador', 'Lucía Paredes · Fuerza', 'Marco Vílchez']);
    expect(text('[data-testid=today-label]')).toBe('hoy, 19 sep 2026');
  });

  it('sin entrenador elegido no hay horarios y no se consulta la disponibilidad', () => {
    setup();
    expect(text('[data-testid=slots-idle]')).toContain('Selecciona un entrenador');
    expect(chips()).toHaveLength(0);
    expect(availability).not.toHaveBeenCalled();
  });

  it('al elegir entrenador muestra las horas futuras y deshabilita las ocupadas', () => {
    setup();
    chooseTrainer('lucia@smartgym.pe');
    expect(availability).toHaveBeenCalledWith('lucia@smartgym.pe', '2026-09-19');
    expect(chips()[0].textContent!.trim()).toBe('15:30'); // las anteriores a las 15:10 no aparecen
    expect(chips().some((c) => c.textContent!.trim() === '09:00')).toBe(false);
    expect(chip('16:00').disabled).toBe(true);
    expect(chip('16:00').getAttribute('aria-label')).toBe('16:00, ocupada');
    expect(chip('18:00').disabled).toBe(true);
    expect(chip('16:30').disabled).toBe(false);
  });

  it('elegir una hora la marca y solo una a la vez', () => {
    setup();
    chooseTrainer('lucia@smartgym.pe');
    chip('16:30').click();
    fixture.detectChanges();
    expect(chip('16:30').getAttribute('aria-pressed')).toBe('true');
    chip('17:00').click();
    fixture.detectChanges();
    expect(chip('16:30').getAttribute('aria-pressed')).toBe('false');
    expect(chip('17:00').getAttribute('aria-pressed')).toBe('true');
  });

  it('al cambiar de entrenador se recarga la disponibilidad y se limpia la hora elegida', () => {
    setup({ availability: (e) => of(avail(e, e === 'marco@smartgym.pe' ? ['16:30'] : [])) });
    chooseTrainer('lucia@smartgym.pe');
    chip('16:30').click();
    fixture.detectChanges();
    chooseTrainer('marco@smartgym.pe');
    expect(availability).toHaveBeenLastCalledWith('marco@smartgym.pe', '2026-09-19');
    expect(chip('16:30').disabled).toBe(true);
    expect(chips().filter((c) => c.getAttribute('aria-pressed') === 'true')).toHaveLength(0);
  });

  it('a las 21:45 ya no quedan horarios: estado vacío', () => {
    vi.setSystemTime(new Date(2026, 8, 19, 21, 45));
    setup();
    chooseTrainer('lucia@smartgym.pe');
    expect(el.textContent).toContain('Ya no hay horarios disponibles hoy');
    expect(chips()).toHaveLength(0);
  });

  it('con todas las horas ocupadas se muestran deshabilitadas', () => {
    vi.setSystemTime(new Date(2026, 8, 19, 21, 0));
    setup({ availability: (e) => of(avail(e, ['21:00', '21:30'])) });
    chooseTrainer('lucia@smartgym.pe');
    expect(chips().map((c) => [c.textContent!.trim(), c.disabled])).toEqual([['21:30', true]]);
  });

  it('error al cargar horarios: aviso con Reintentar', () => {
    let fail = true;
    setup({ availability: (e) => (fail ? throwError(() => err(500)) : of(avail(e, []))) });
    chooseTrainer('lucia@smartgym.pe');
    expect(q('[data-testid=slots-error]')).not.toBeNull();
    fail = false;
    q<HTMLButtonElement>('[data-testid=slots-retry]').click();
    fixture.detectChanges();
    expect(chips().length).toBeGreaterThan(0);
  });

  it('enviar sin entrenador ni hora muestra los errores y no llama al API', () => {
    setup();
    submit();
    expect(el.textContent).toContain('Este campo es obligatorio.');
    expect(create).not.toHaveBeenCalled();
  });

  it('enviar sin hora: error en la hora', () => {
    setup();
    chooseTrainer('lucia@smartgym.pe');
    submit();
    expect(text('[data-testid=time-msg]')).toContain('obligatorio');
    expect(create).not.toHaveBeenCalled();
  });

  it('nota: 250 caracteres se aceptan y 251 no', () => {
    setup();
    chooseTrainer('lucia@smartgym.pe');
    chip('16:30').click();
    type('x'.repeat(251));
    expect(text('[data-testid=note-count]')).toBe('251 / 250');
    submit();
    expect(text('[data-testid=note-msg]')).toContain('Máximo 250');
    expect(create).not.toHaveBeenCalled();
    type('x'.repeat(250));
    submit();
    expect(create).toHaveBeenCalledTimes(1);
  });

  it('crear reserva: envía el correo del usuario, avisa, limpia y recarga horas y reservas', () => {
    setup();
    chooseTrainer('lucia@smartgym.pe');
    chip('16:30').click();
    type('  Reforzar piernas ');
    submit();
    expect(create).toHaveBeenCalledWith({
      customer_email: 'ana@correo.com',
      trainer_email: 'lucia@smartgym.pe',
      date: '2026-09-19', // hoy local del cliente
      utcOffsetMinutes: -new Date().getTimezoneOffset() || 0,
      time: '16:30',
      note: 'Reforzar piernas',
    });
    expect(toasts.success).toHaveBeenCalledWith(
      'Tu reserva de hoy a las 16:30 con Lucía Paredes quedó registrada.',
      'Reserva creada',
    );
    expect(availability).toHaveBeenCalledTimes(2);
    expect(list).toHaveBeenCalledTimes(2);
    expect(q<HTMLTextAreaElement>('[data-testid=note]').value).toBe('');
    expect(chips().filter((c) => c.getAttribute('aria-pressed') === 'true')).toHaveLength(0);
    expect(q('[data-testid=time-msg]')).toBeNull(); // limpiar tras el éxito no marca error
  });

  it('sin nota no se envía el campo', () => {
    setup();
    chooseTrainer('marco@smartgym.pe');
    chip('16:30').click();
    submit();
    expect(create.mock.calls[0][0]).not.toHaveProperty('note');
  });

  it('doble clic: un solo envío mientras dura la petición', () => {
    const pending = new Subject<Booking>();
    setup({ create: () => pending });
    chooseTrainer('lucia@smartgym.pe');
    chip('16:30').click();
    submit();
    submit();
    expect(create).toHaveBeenCalledTimes(1);
    expect(q<HTMLButtonElement>('[data-testid=submit]').disabled).toBe(true);
    pending.next({ ...BOOKINGS[0], id: 9 });
    pending.complete();
    fixture.detectChanges();
    expect(q<HTMLButtonElement>('[data-testid=submit]').disabled).toBe(false);
  });

  it('409: recarga la disponibilidad y limpia la hora (el toast lo pone el interceptor)', () => {
    let calls = 0;
    setup({
      create: () =>
        throwError(() => err(409, 'Trainer already has a booking at 2026-09-19 16:30.')),
      availability: (e) => of(avail(e, ++calls > 1 ? ['16:30'] : [])),
    });
    chooseTrainer('lucia@smartgym.pe');
    chip('16:30').click();
    submit();
    expect(availability).toHaveBeenCalledTimes(2);
    expect(chip('16:30').disabled).toBe(true);
    expect(toasts.success).not.toHaveBeenCalled();
    expect(q('[data-testid=booking-failure]')).toBeNull();
    expect(q('[data-testid=time-msg]')).toBeNull();
  });

  it('422 (hora pasada): recarga la disponibilidad y no muestra "obligatorio" en la hora', () => {
    setup({ create: () => throwError(() => err(422, 'Bookings in the past are not allowed.')) });
    chooseTrainer('lucia@smartgym.pe');
    chip('16:30').click();
    submit();
    expect(availability).toHaveBeenCalledTimes(2);
    expect(q('[data-testid=time-msg]')).toBeNull();
    expect(q<HTMLButtonElement>('[data-testid=submit]').disabled).toBe(false);
  });

  it('404 (el entrenador ya no existe): mensaje claro y recarga de entrenadores', () => {
    setup({ create: () => throwError(() => err(404, 'Trainer does not exist: x')) });
    chooseTrainer('lucia@smartgym.pe');
    chip('16:30').click();
    submit();
    expect(q('[data-testid=booking-failure]')).not.toBeNull();
    expect(trainersList).toHaveBeenCalledTimes(2);
  });

  it('404 con recarga que ya no trae al entrenador: se limpia la selección pero el aviso se conserva', () => {
    let calls = 0;
    setup({
      trainers: () => of(++calls > 1 ? [TRAINERS[1]] : TRAINERS),
      create: () => throwError(() => err(404, 'Trainer does not exist: lucia@smartgym.pe')),
    });
    chooseTrainer('lucia@smartgym.pe');
    chip('16:30').click();
    submit();
    expect(trainersList).toHaveBeenCalledTimes(2);
    expect(q<HTMLSelectElement>('[data-testid=trainer-select]').value).toBe('');
    expect(q('[data-testid=booking-failure]')).not.toBeNull();
    // Al elegir otro entrenador el aviso desaparece.
    chooseTrainer('marco@smartgym.pe');
    expect(q('[data-testid=booking-failure]')).toBeNull();
  });

  it('una respuesta lenta de un entrenador anterior no pisa la del actual', () => {
    const first = new Subject<TrainerAvailability>();
    setup({ availability: (e) => (e === 'lucia@smartgym.pe' ? first : of(avail(e, ['17:00']))) });
    chooseTrainer('lucia@smartgym.pe');
    chooseTrainer('marco@smartgym.pe');
    first.next(avail('lucia@smartgym.pe', ['19:00']));
    fixture.detectChanges();
    expect(chip('17:00').disabled).toBe(true);
    expect(chip('19:00').disabled).toBe(false);
  });

  it('entrenadores: esqueleto, vacío y error con Reintentar', () => {
    setup({ trainers: () => new Subject<Trainer[]>() });
    expect(q('[data-testid=loading-card]')).not.toBeNull();
    TestBed.resetTestingModule();
    setup({ trainers: () => of([]) });
    expect(text('[data-testid=empty-state]')).toContain('Aún no hay entrenadores registrados');
    TestBed.resetTestingModule();
    let fail = true;
    setup({ trainers: () => (fail ? throwError(() => err(500)) : of(TRAINERS)) });
    expect(text('[data-testid=empty-state]')).toContain('No pudimos cargar los entrenadores');
    fail = false;
    q<HTMLButtonElement>('[data-testid=trainers-retry]').click();
    fixture.detectChanges();
    expect(q('[data-testid=trainer-select]')).not.toBeNull();
  });

  describe('Mis reservas', () => {
    it('más recientes primero, con el nombre del entrenador y la etiqueta Próxima solo en las futuras', () => {
      setup();
      const parts = (r: HTMLElement) => ({
        time: r.querySelector('.mine-time')!.textContent!.trim(),
        who: r.querySelector('.mine-who')!.textContent!.trim(),
        when: r.querySelector('.mine-when')!.textContent!.trim(),
        upcoming: !!r.querySelector('.sg-badge'),
      });
      expect(qa('[data-testid=booking-row]').map(parts)).toEqual([
        { time: '18:30', who: 'Marco Vílchez', when: 'Hoy · 19 sep', upcoming: true },
        { time: '17:00', who: 'Lucía Paredes', when: '12 sep', upcoming: false },
      ]);
      expect(qa('[data-testid=booking-row]')[1].classList.contains('mine-past')).toBe(true);
    });

    it('vacío, esqueleto y error con Reintentar', () => {
      setup({ bookings: () => of([]) });
      expect(el.textContent).toContain('Aún no tienes reservas');
      TestBed.resetTestingModule();
      setup({ bookings: () => new Subject<Booking[]>() });
      expect(q('[data-testid=loading-table]')).not.toBeNull();
      TestBed.resetTestingModule();
      let fail = true;
      setup({ bookings: () => (fail ? throwError(() => err(500)) : of(BOOKINGS)) });
      expect(el.textContent).toContain('No pudimos cargar tus reservas');
      fail = false;
      q<HTMLButtonElement>('[data-testid=bookings-retry]').click();
      fixture.detectChanges();
      expect(qa('[data-testid=booking-row]')).toHaveLength(2);
    });
  });
});
