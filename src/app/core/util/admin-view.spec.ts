import { Booking } from '../models';
import { filterPeople, invitationOutcome, sortByName, todayBookings } from './admin-view';

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
