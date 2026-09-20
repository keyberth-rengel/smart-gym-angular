import { Booking, Trainer } from '../models';
import { bookingDayLabel, bookingRows, trainerName } from './booking-view';
import { formatLongDate, relativeDay, todayLabel } from './dates';

const trainers: Trainer[] = [
  { email: 'lucia@smartgym.pe', name: 'Lucía Paredes', age: 33, specialty: 'Fuerza' },
];
const b = (id: number, date: string, time: string, trainer = 'lucia@smartgym.pe'): Booking => ({
  id,
  customer_email: 'ana@correo.com',
  trainer_email: trainer,
  date,
  time,
  note: null,
});
const now = new Date(2026, 8, 19, 15, 10);

describe('booking-view', () => {
  it('resuelve el nombre del entrenador sin distinguir mayúsculas y cae al correo', () => {
    expect(trainerName(trainers, 'LUCIA@smartgym.pe')).toBe('Lucía Paredes');
    expect(trainerName(trainers, 'otro@smartgym.pe')).toBe('otro@smartgym.pe');
    expect(trainerName([], 'x@y.z')).toBe('x@y.z');
  });

  it('etiqueta el día: hoy con fecha, otros días sin año y de otro año con año', () => {
    expect(bookingDayLabel('2026-09-19', now)).toBe('Hoy · 19 sep');
    expect(bookingDayLabel('2026-09-12', now)).toBe('12 sep');
    expect(bookingDayLabel('2025-12-05', now)).toBe('05 dic 2025');
  });

  it('arma las filas: más recientes primero, próximas marcadas, hora sin segundos', () => {
    const rows = bookingRows(
      [b(1, '2026-09-12', '17:00'), b(2, '2026-09-19', '18:30:00'), b(3, '2026-09-19', '10:00')],
      trainers,
      now,
    );
    expect(rows.map((r) => [r.id, r.time, r.trainer, r.day, r.upcoming])).toEqual([
      [2, '18:30', 'Lucía Paredes', 'Hoy · 19 sep', true],
      [3, '10:00', 'Lucía Paredes', 'Hoy · 19 sep', false],
      [1, '17:00', 'Lucía Paredes', '12 sep', false],
    ]);
  });

  it('fechas largas y relativas', () => {
    expect(formatLongDate(new Date(2026, 8, 19))).toBe('Sábado, 19 de septiembre de 2026');
    expect(formatLongDate(new Date(2026, 8, 20))).toBe('Domingo, 20 de septiembre de 2026');
    expect(todayLabel(now)).toBe('hoy, 19 sep 2026');
    expect(relativeDay('2026-09-19', now)).toBe('Hoy');
    expect(relativeDay('2026-09-20', now)).toBe('20 sep');
    expect(relativeDay('2027-01-02', now)).toBe('02 ene 2027');
    expect(relativeDay('2026-09-20', now, true)).toBe('20 sep 2026');
  });
});
