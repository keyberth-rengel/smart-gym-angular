import { AttendanceRecord, Booking } from '../models';
import {
  adminBookingRows,
  attendanceRows,
  bookingSummary,
  filterBookings,
  filterPeople,
  invitationOutcome,
  parseWelcome,
  sortByName,
  todayBookings,
  trainerOptions,
  welcomeMessage,
} from './admin-view';

const b = (id: number, date: string, time: string, c: string, t: string): Booking => ({
  id,
  customer_email: c,
  trainer_email: t,
  date,
  time,
  note: null,
});

describe('sortByName', () => {
  it('ordena sin distinguir acentos ni mayúsculas y no modifica el original', () => {
    const list = [{ name: 'Óscar' }, { name: 'alicia' }, { name: 'Zoe' }, { name: 'Ángel' }];
    const sorted = sortByName(list);
    expect(sorted.map((p) => p.name)).toEqual(['alicia', 'Ángel', 'Óscar', 'Zoe']);
    expect(list.map((p) => p.name)).toEqual(['Óscar', 'alicia', 'Zoe', 'Ángel']);
  });
});

describe('filterPeople', () => {
  const people = [
    { name: 'María López', email: 'maria@x.com' },
    { name: 'José Ñuñez', email: 'jose@y.com' },
  ];
  it('busca por nombre o correo sin acentos ni mayúsculas', () => {
    expect(filterPeople(people, 'MARIA')).toHaveLength(1);
    expect(filterPeople(people, 'nunez')[0].name).toBe('José Ñuñez');
    expect(filterPeople(people, 'y.com')[0].email).toBe('jose@y.com');
  });
  it('sin texto devuelve todo y sin coincidencias nada', () => {
    expect(filterPeople(people, '  ')).toHaveLength(2);
    expect(filterPeople(people, 'zzz')).toEqual([]);
  });
});

describe('todayBookings', () => {
  const now = new Date(2026, 8, 19, 12, 0);
  const customers = [{ name: 'Carlos Mendoza', email: 'carlos@x.com' }];
  const trainers = [{ name: 'Lucía Paredes', email: 'lucia@x.com' }];

  it('solo las de hoy, ordenadas por hora y con nombres', () => {
    const rows = todayBookings(
      [
        b(2, '2026-09-19', '18:00', 'carlos@x.com', 'lucia@x.com'),
        b(1, '2026-09-19', '09:30', 'CARLOS@x.com', 'lucia@x.com'),
        b(3, '2026-09-18', '10:00', 'carlos@x.com', 'lucia@x.com'),
        b(4, '2026-09-20', '10:00', 'carlos@x.com', 'lucia@x.com'),
      ],
      customers,
      trainers,
      now,
    );
    expect(rows).toEqual([
      { id: 1, time: '09:30', customer: 'Carlos Mendoza', trainer: 'Lucía Paredes' },
      { id: 2, time: '18:00', customer: 'Carlos Mendoza', trainer: 'Lucía Paredes' },
    ]);
  });

  it('sin nombres conocidos muestra los correos', () => {
    const rows = todayBookings(
      [b(1, '2026-09-19', '09:30:00', 'otro@x.com', 'sin@x.com')],
      [],
      [],
      now,
    );
    expect(rows).toEqual([
      { id: 1, time: '09:30', customer: 'otro@x.com', trainer: 'sin@x.com' },
    ]);
  });

  it('medianoche: a las 00:00 y a las 23:59 "hoy" es el mismo día', () => {
    const list = [b(1, '2026-09-19', '10:00', 'a@x.com', 'b@x.com')];
    expect(todayBookings(list, [], [], new Date(2026, 8, 19, 0, 0))).toHaveLength(1);
    expect(todayBookings(list, [], [], new Date(2026, 8, 19, 23, 59))).toHaveLength(1);
    expect(todayBookings(list, [], [], new Date(2026, 8, 20, 0, 0))).toHaveLength(0);
  });
});

describe('invitationOutcome', () => {
  const inv = (status: 'INVITED' | 'ROLE_UPDATED' | 'SKIPPED' | 'FAILED') => ({
    status,
    message: 'x',
  });

  it('alta: cada estado tiene su tono y su texto', () => {
    expect(invitationOutcome(inv('INVITED'), 'a@x.com', true)).toEqual({
      tone: 'success',
      text: 'Entrenador registrado. Invitación enviada por correo.',
    });
    expect(invitationOutcome(inv('ROLE_UPDATED'), 'a@x.com', true)).toEqual({
      tone: 'success',
      text: 'Entrenador registrado. Esa persona ya tenía cuenta: ahora tiene el rol Entrenador (debe cerrar y abrir sesión).',
    });
    expect(invitationOutcome(inv('SKIPPED'), 'a@x.com', true)).toEqual({
      tone: 'warning',
      text: 'Entrenador registrado, pero las invitaciones no están configuradas en el servidor.',
    });
    expect(invitationOutcome(inv('FAILED'), 'a@x.com', true)).toEqual({
      tone: 'danger',
      text: 'Entrenador registrado, pero no se pudo enviar la invitación. Puedes reintentarla desde la tabla.',
    });
  });

  it('reenvío: menciona al entrenador y no dice "registrado"', () => {
    expect(invitationOutcome(inv('INVITED'), 'a@x.com', false).text).toBe(
      'Invitación enviada a a@x.com.',
    );
    expect(invitationOutcome(inv('ROLE_UPDATED'), 'a@x.com', false).text).toContain('a@x.com ya tenía cuenta');
    expect(invitationOutcome(inv('SKIPPED'), 'a@x.com', false).tone).toBe('warning');
    const failed = invitationOutcome(inv('FAILED'), 'a@x.com', false);
    expect(failed.tone).toBe('danger');
    expect(failed.text).not.toContain('registrado');
  });
});

describe('reservas del admin', () => {
  const NOW = new Date(2026, 8, 19, 15, 10);
  const bookings: Booking[] = [
    { id: 9, customer_email: 'miguel@x.com', trainer_email: 'lucia@x.com', date: '2026-09-18', time: '07:30', note: null },
    { id: 14, customer_email: 'Carlos@x.com', trainer_email: 'Lucia@x.com', date: '2026-09-19', time: '16:30', note: ' Piernas ' },
    { id: 13, customer_email: 'rosa@x.com', trainer_email: 'marco@x.com', date: '2026-09-19', time: '17:00', note: null },
    { id: 12, customer_email: 'rosa@x.com', trainer_email: 'marco@x.com', date: '2026-09-19', time: '17:00:00', note: null },
  ];
  const customers = [
    { email: 'carlos@x.com', name: 'Carlos Mendoza' },
    { email: 'rosa@x.com', name: 'Rosa Lima' },
  ];
  const trainers = [
    { email: 'lucia@x.com', name: 'Lucía Paredes' },
    { email: 'marco@x.com', name: 'Marco Vílchez' },
  ];

  describe('filterBookings', () => {
    it('sin filtros devuelve todas', () => {
      expect(filterBookings(bookings, { trainerEmail: '', date: '' })).toHaveLength(4);
    });
    it('por entrenador sin distinguir mayúsculas del correo', () => {
      const r = filterBookings(bookings, { trainerEmail: 'LUCIA@x.com', date: '' });
      expect(r.map((x) => x.id)).toEqual([9, 14]);
    });
    it('por fecha exacta', () => {
      expect(filterBookings(bookings, { trainerEmail: '', date: '2026-09-18' }).map((x) => x.id)).toEqual([9]);
    });
    it('combinados y sin coincidencias', () => {
      expect(filterBookings(bookings, { trainerEmail: 'lucia@x.com', date: '2026-09-19' }).map((x) => x.id)).toEqual([14]);
      expect(filterBookings(bookings, { trainerEmail: 'marco@x.com', date: '2026-09-18' })).toEqual([]);
    });
    it('no modifica el original', () => {
      const copy = [...bookings];
      filterBookings(bookings, { trainerEmail: 'lucia@x.com', date: '' });
      expect(bookings).toEqual(copy);
    });
  });

  describe('adminBookingRows', () => {
    const rows = adminBookingRows(bookings, customers, trainers, NOW);
    it('más reciente primero: fecha y hora descendentes, con id como desempate', () => {
      expect(rows.map((r) => r.id)).toEqual([13, 12, 14, 9]);
    });
    it('resuelve nombres (sin distinguir mayúsculas) y cae al correo si faltan', () => {
      const r14 = rows.find((r) => r.id === 14)!;
      expect(r14.customer).toBe('Carlos Mendoza');
      expect(r14.trainer).toBe('Lucía Paredes');
      const r9 = rows.find((r) => r.id === 9)!;
      expect(r9.customer).toBe('miguel@x.com');
      expect(r9.customerEmail).toBe('miguel@x.com');
    });
    it('hora en HH:mm, nota recortada y día relativo', () => {
      expect(rows.find((r) => r.id === 12)!.time).toBe('17:00');
      expect(rows.find((r) => r.id === 14)!.note).toBe('Piernas');
      expect(rows.find((r) => r.id === 13)!.note).toBe('');
      expect(rows.find((r) => r.id === 14)!.dayLabel).toBe('Hoy');
      expect(rows.find((r) => r.id === 9)!.dayLabel).toBe('18 sep 2026');
    });
  });

  it('bookingSummary: día, hora, cliente y entrenador', () => {
    const [first] = adminBookingRows([bookings[1]], customers, trainers, NOW);
    expect(bookingSummary(first)).toBe('Hoy 16:30 · Carlos Mendoza con Lucía Paredes');
  });

  describe('trainerOptions', () => {
    it('con entrenadores: la lista ordenada por nombre', () => {
      expect(trainerOptions([trainers[1], trainers[0]], bookings).map((t) => t.name)).toEqual([
        'Lucía Paredes',
        'Marco Vílchez',
      ]);
    });
    it('sin entrenadores: correos distintos de las reservas (sin distinguir mayúsculas)', () => {
      const opts = trainerOptions([], bookings);
      expect(opts.map((t) => t.email.toLowerCase())).toEqual(['lucia@x.com', 'marco@x.com']);
      expect(opts.every((t) => t.name === t.email)).toBe(true);
    });
  });
});

describe('asistencia del admin', () => {
  describe('parseWelcome / welcomeMessage', () => {
    it('extrae nombre y correo del texto en inglés del backend', () => {
      expect(parseWelcome('Welcome Carlos Mendoza! Access recorded for carlos@x.com.')).toEqual({
        name: 'Carlos Mendoza',
        email: 'carlos@x.com',
      });
      expect(welcomeMessage('Welcome Carlos Mendoza! Access recorded for carlos@x.com.')).toBe(
        '¡Bienvenido Carlos Mendoza! Ingreso registrado para carlos@x.com.',
      );
    });
    it('nombres con signos de exclamación o puntos y sin punto final', () => {
      expect(parseWelcome('Welcome Dr. Who! Access recorded for who@x.com')).toEqual({
        name: 'Dr. Who',
        email: 'who@x.com',
      });
    });
    it('texto distinto, vacío o nulo: mensaje genérico', () => {
      for (const raw of ['Hola', '', null, undefined]) {
        expect(parseWelcome(raw)).toBeNull();
        expect(welcomeMessage(raw)).toBe('Ingreso registrado correctamente.');
      }
    });
  });

  describe('attendanceRows', () => {
    const records: AttendanceRecord[] = [
      { id: 1, email: 'carlos@x.com', role: 'CUSTOMER', timestamp: '2026-09-15T07:05:00' },
      { id: 3, email: 'lucia@x.com', role: 'TRAINER', timestamp: '2026-09-19T06:45:10' },
      { id: 2, email: 'carlos@x.com', role: 'CUSTOMER', timestamp: '2026-09-19T06:45:10' },
    ];
    it('más reciente primero (timestamp y luego id) sin modificar el original', () => {
      const rows = attendanceRows(records);
      expect(rows.map((r) => r.id)).toEqual([3, 2, 1]);
      expect(records.map((r) => r.id)).toEqual([1, 3, 2]);
    });
    it('formatea fecha y hora y asigna etiqueta y tono del rol', () => {
      const rows = attendanceRows(records);
      expect(rows[0]).toMatchObject({ date: '19 sep 2026', time: '06:45', roleLabel: 'Entrenador', tone: 'green' });
      expect(rows[2]).toMatchObject({ date: '15 sep 2026', time: '07:05', roleLabel: 'Cliente', tone: 'blue' });
    });
    it('lista vacía', () => {
      expect(attendanceRows([])).toEqual([]);
    });
  });
});
