import {
  allSlotTimes,
  availableSlots,
  bookingMoment,
  isUpcoming,
  nextBooking,
  sortBookingsDesc,
} from './booking-slots';

const at = (h: number, m = 0, s = 0) => new Date(2026, 8, 19, h, m, s);

describe('booking-slots', () => {
  it('genera 32 horas de 06:00 a 21:30 cada 30 minutos', () => {
    const all = allSlotTimes();
    expect(all).toHaveLength(32);
    expect(all[0]).toBe('06:00');
    expect(all[1]).toBe('06:30');
    expect(all.at(-1)).toBe('21:30');
  });

  it('antes de abrir se ofrecen todas las horas', () => {
    expect(availableSlots([], at(5, 0))).toHaveLength(32);
  });

  it('oculta las horas pasadas y también la del minuto actual (el servidor la rechaza por los segundos)', () => {
    const times = (n: Date) => availableSlots([], n).map((s) => s.time);
    expect(times(at(15, 10))[0]).toBe('15:30');
    expect(times(at(15, 30, 0))[0]).toBe('16:00'); // 15:30:00 exacto: el backend acepta > ahora, se oculta por seguridad
    expect(times(at(15, 29, 59))[0]).toBe('15:30');
    expect(times(at(15, 30, 1))[0]).toBe('16:00');
  });

  it('a las 21:30 ya no queda ninguna y a las 21:29:59 queda la última', () => {
    expect(availableSlots([], at(21, 30))).toEqual([]);
    expect(availableSlots([], at(21, 45))).toEqual([]);
    expect(availableSlots([], at(21, 29, 59)).map((s) => s.time)).toEqual(['21:30']);
    expect(availableSlots([], at(23, 59, 59))).toEqual([]);
  });

  it('marca como ocupadas las horas indicadas, con o sin segundos', () => {
    const slots = availableSlots(['16:00', '18:00:00'], at(15, 10));
    expect(slots.filter((s) => s.booked).map((s) => s.time)).toEqual(['16:00', '18:00']);
    expect(slots.find((s) => s.time === '16:30')?.booked).toBe(false);
  });

  it('una hora ocupada que ya pasó no aparece', () => {
    expect(availableSlots(['09:00'], at(15, 10)).some((s) => s.time === '09:00')).toBe(false);
  });

  it('bookingMoment interpreta fecha y hora como locales', () => {
    const d = bookingMoment({ date: '2026-09-19', time: '16:30' });
    expect([d.getFullYear(), d.getMonth(), d.getDate(), d.getHours(), d.getMinutes()]).toEqual([
      2026, 8, 19, 16, 30,
    ]);
  });

  it('una reserva es próxima si su hora no pasó (borde exacto incluido)', () => {
    expect(isUpcoming({ date: '2026-09-19', time: '16:30' }, at(16, 29, 59))).toBe(true);
    expect(isUpcoming({ date: '2026-09-19', time: '16:30' }, at(16, 30, 0))).toBe(true);
    expect(isUpcoming({ date: '2026-09-19', time: '16:30' }, at(16, 30, 1))).toBe(false);
    expect(isUpcoming({ date: '2026-09-20', time: '06:00' }, at(23, 59))).toBe(true);
    expect(isUpcoming({ date: '2026-09-18', time: '23:59' }, at(0, 0))).toBe(false);
  });

  it('ordena de más reciente a más antigua y elige la próxima más cercana', () => {
    const list = [
      { date: '2026-09-19', time: '18:30' },
      { date: '2026-09-12', time: '17:00' },
      { date: '2026-09-19', time: '16:30' },
      { date: '2026-09-20', time: '07:00' },
    ];
    expect(sortBookingsDesc(list).map((b) => `${b.date} ${b.time}`)).toEqual([
      '2026-09-20 07:00',
      '2026-09-19 18:30',
      '2026-09-19 16:30',
      '2026-09-12 17:00',
    ]);
    expect(nextBooking(list, at(17, 0))).toEqual({ date: '2026-09-19', time: '18:30' });
    expect(nextBooking(list, at(19, 0))).toEqual({ date: '2026-09-20', time: '07:00' });
    expect(nextBooking(list, new Date(2026, 8, 21))).toBeNull();
    expect(nextBooking([], at(10))).toBeNull();
  });
});
