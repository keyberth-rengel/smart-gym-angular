import { Booking } from '../models';
import {
  addDays,
  agendaRows,
  customerLastLabel,
  customerName,
  dayHeading,
  filterCustomers,
  groupByDate,
  initials,
  normalize,
  weekDays,
  weekRangeLabel,
  weekStart,
} from './trainer-view';

const b = (
  id: number,
  date: string,
  time: string,
  email = 'a@x.com',
  note: string | null = null,
): Booking => ({
  id,
  customer_email: email,
  trainer_email: 't@x.com',
  date,
  time,
  note,
});

describe('trainer-view: semana', () => {
  it('weekStart devuelve el lunes de cualquier día de la semana', () => {
    // sábado 19, domingo 20, lunes 14 y miércoles 16 de septiembre de 2026
    for (const d of [19, 20, 14, 16]) {
      const s = weekStart(new Date(2026, 8, d, 15, 30));
      expect([s.getFullYear(), s.getMonth(), s.getDate(), s.getHours()]).toEqual([2026, 8, 14, 0]);
    }
  });

  it('weekStart cruza de mes: jueves 1 de octubre -> lunes 28 de septiembre', () => {
    const s = weekStart(new Date(2026, 9, 1));
    expect([s.getMonth(), s.getDate()]).toEqual([8, 28]);
  });

  it('addDays suma y resta días (también entre meses) sin modificar el original', () => {
    const d = new Date(2026, 8, 28);
    expect(addDays(d, 5).getDate()).toBe(3);
    expect(addDays(d, 5).getMonth()).toBe(9);
    expect(addDays(d, -28).getMonth()).toBe(7);
    expect(d.getDate()).toBe(28);
  });

  it('weekDays devuelve lunes a domingo y marca hoy', () => {
    const days = weekDays(new Date(2026, 8, 14), new Date(2026, 8, 19, 10));
    expect(days.map((x) => x.short)).toEqual(['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']);
    expect(days.map((x) => x.iso)[0]).toBe('2026-09-14');
    expect(days[6].iso).toBe('2026-09-20');
    expect(days.filter((x) => x.isToday).map((x) => x.iso)).toEqual(['2026-09-19']);
    expect(days[5].num).toBe(19);
  });

  it('weekDays de otra semana no marca hoy', () => {
    const days = weekDays(new Date(2026, 8, 21), new Date(2026, 8, 19));
    expect(days.some((x) => x.isToday)).toBe(false);
  });

  it('weekRangeLabel: mismo mes y cruce de mes', () => {
    expect(weekRangeLabel(new Date(2026, 8, 14))).toBe('14 – 20 sep');
    expect(weekRangeLabel(new Date(2026, 8, 28))).toBe('28 sep – 04 oct');
  });

  it('dayHeading: "Sábado 19 sep"', () => {
    expect(dayHeading(new Date(2026, 8, 19))).toBe('Sábado 19 sep');
    expect(dayHeading(new Date(2026, 8, 20))).toBe('Domingo 20 sep');
  });
});

describe('trainer-view: reservas', () => {
  it('groupByDate agrupa por fecha y ordena cada día por hora', () => {
    const g = groupByDate([
      b(1, '2026-09-19', '18:00'),
      b(2, '2026-09-18', '09:00'),
      b(3, '2026-09-19', '07:30'),
    ]);
    expect([...g.keys()].sort()).toEqual(['2026-09-18', '2026-09-19']);
    expect(g.get('2026-09-19')!.map((x) => x.id)).toEqual([3, 1]);
  });

  it('groupByDate sin reservas es vacío', () => {
    expect(groupByDate([]).size).toBe(0);
  });

  describe('agendaRows', () => {
    const now = new Date(2026, 8, 19, 15, 10);
    const customers = [{ email: 'ana@x.com', name: 'Ana Pérez' }];

    it('ordena por hora, resuelve nombres (o correo) y marca solo la primera próxima', () => {
      const rows = agendaRows(
        [
          b(1, '2026-09-19', '18:00', 'otro@x.com', 'Fuerza'),
          b(2, '2026-09-19', '09:00', 'ANA@x.com'),
          b(3, '2026-09-19', '16:30', 'ana@x.com'),
        ],
        customers,
        now,
      );
      expect(rows.map((r) => r.time)).toEqual(['09:00', '16:30', '18:00']);
      expect(rows.map((r) => r.name)).toEqual(['Ana Pérez', 'Ana Pérez', 'otro@x.com']);
      expect(rows.map((r) => r.next)).toEqual([false, true, false]);
      expect(rows[2].note).toBe('Fuerza');
    });

    it('sin citas próximas nadie es "próxima"', () => {
      expect(agendaRows([b(1, '2026-09-19', '09:00')], customers, now).every((r) => !r.next)).toBe(
        true,
      );
    });

    it('una cita justo a la hora actual todavía es próxima', () => {
      const rows = agendaRows(
        [b(1, '2026-09-19', '15:10')],
        customers,
        new Date(2026, 8, 19, 15, 10, 0),
      );
      expect(rows[0].next).toBe(true);
    });

    it('lista vacía', () => {
      expect(agendaRows([], customers, now)).toEqual([]);
    });
  });
});

describe('trainer-view: clientes', () => {
  const list = [
    { email: 'maria@x.com', name: 'María Pérez' },
    { email: 'jose@x.com', name: 'José Ñandú' },
    { email: 'ana@correo.com', name: 'Ana' },
  ];

  it('normalize quita acentos y mayúsculas', () => {
    expect(normalize('  MARÍA Ñandú ')).toBe('maria nandu');
  });

  it('filterCustomers ignora acentos y mayúsculas en nombre y correo', () => {
    expect(filterCustomers(list, 'maria').map((c) => c.email)).toEqual(['maria@x.com']);
    expect(filterCustomers(list, 'JOSÉ').map((c) => c.email)).toEqual(['jose@x.com']);
    expect(filterCustomers(list, 'nandu').map((c) => c.email)).toEqual(['jose@x.com']);
    expect(filterCustomers(list, '@correo').map((c) => c.email)).toEqual(['ana@correo.com']);
  });

  it('filterCustomers: búsqueda vacía o en blanco devuelve todos (copia) y sin coincidencias, nada', () => {
    expect(filterCustomers(list, '')).toEqual(list);
    expect(filterCustomers(list, '   ')).toEqual(list);
    expect(filterCustomers(list, '')).not.toBe(list);
    expect(filterCustomers(list, 'zzz')).toEqual([]);
  });

  it('customerName resuelve por correo sin distinguir mayúsculas y cae al correo', () => {
    expect(customerName(list, 'MARIA@x.com')).toBe('María Pérez');
    expect(customerName(list, 'nadie@x.com')).toBe('nadie@x.com');
  });

  describe('customerLastLabel', () => {
    const now = new Date(2026, 8, 19, 15, 10);
    const at = (date: string, time = '16:30') => ({
      last_booking_date: date,
      last_booking_time: time,
    });

    it('hoy, futura y pasada', () => {
      expect(customerLastLabel(at('2026-09-19'), now)).toBe('Hoy 16:30');
      expect(customerLastLabel(at('2026-09-20', '09:00'), now)).toBe('20 sep 09:00');
      expect(customerLastLabel(at('2026-09-12'), now)).toBe('12 sep');
    });

    it('una pasada de otro año lleva el año', () => {
      expect(customerLastLabel(at('2025-12-05'), now)).toBe('05 dic 2025');
    });

    it('acepta la hora con segundos', () => {
      expect(customerLastLabel(at('2026-09-19', '16:30:00'), now)).toBe('Hoy 16:30');
    });
  });

  it('initials: dos palabras, una palabra, varias y vacío', () => {
    expect(initials('Carlos Mendoza')).toBe('CM');
    expect(initials('lucía')).toBe('L');
    expect(initials('Ana María de la Cruz')).toBe('AC');
    expect(initials('   ')).toBe('?');
  });
});
