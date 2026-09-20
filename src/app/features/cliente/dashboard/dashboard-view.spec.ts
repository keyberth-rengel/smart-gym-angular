import { AttendanceRecord, Booking, RoutineHistoryItem, Trainer } from '../../../core/models';
import { attendanceCard, nextBookingCard, progressCard, routineCard } from './dashboard-view';

const sat = new Date(2026, 8, 19, 15, 10); // sábado
const sun = new Date(2026, 8, 20, 9, 0); // domingo

const history: RoutineHistoryItem[] = [
  { created_at: '2026-08-11T10:00:00', plan: { saturday: 'Back' } },
  { created_at: '2026-09-08T10:00:00', plan: { monday: 'Legs', saturday: 'Cardio' } },
];
const trainers: Trainer[] = [{ email: 'marco@smartgym.pe', name: 'Marco Vílchez', age: 29, specialty: null }];
const bk = (date: string, time: string): Booking => ({ id: 1, customer_email: 'a@b.c', trainer_email: 'marco@smartgym.pe', date, time, note: null });

describe('dashboard-view', () => {
  describe('routineCard', () => {
    it('usa la rutina activa (la última) y traduce el bloque de hoy', () => {
      expect(routineCard(history, sat)).toEqual({ value: 'Cardio', sub: 'Plan de hoy · activa desde el 08 sep' });
    });
    it('el domingo es Descanso', () => {
      expect(routineCard(history, sun).value).toBe('Descanso');
    });
    it('un día sin bloque en el plan también es Descanso', () => {
      expect(routineCard(history, new Date(2026, 8, 22)).value).toBe('Descanso'); // martes sin bloque
    });
    it('sin rutina', () => {
      expect(routineCard([], sat)).toEqual({ value: 'Sin rutina asignada', sub: 'Tu entrenador o recepción te la asignará' });
    });
  });

  describe('nextBookingCard', () => {
    it('reserva de hoy: "Hoy · HH:mm" con el nombre del entrenador', () => {
      expect(nextBookingCard([bk('2026-09-19', '18:30')], trainers, sat)).toEqual({ value: 'Hoy · 18:30', sub: 'con Marco Vílchez' });
    });
    it('elige la futura más cercana e ignora las pasadas', () => {
      const list = [bk('2026-09-19', '10:00'), bk('2026-09-25', '07:00'), bk('2026-09-20', '17:00')];
      expect(nextBookingCard(list, trainers, sat).value).toBe('20 sep · 17:00');
    });
    it('sin entrenador conocido usa el correo', () => {
      expect(nextBookingCard([bk('2026-09-19', '18:30')], [], sat).sub).toBe('con marco@smartgym.pe');
    });
    it('sin reservas próximas', () => {
      expect(nextBookingCard([bk('2026-09-19', '10:00')], trainers, sat).value).toBe('Sin reservas próximas');
      expect(nextBookingCard([], trainers, sat).sub).toBe('Reserva una sesión con tu entrenador');
    });
  });

  describe('progressCard', () => {
    it('muestra el registro más reciente aunque llegue desordenado', () => {
      const items = [
        { date: '2026-09-15', weight_kg: 74.5, body_fat_pct: 18.2, muscle_pct: 42.1 },
        { date: '2026-08-31', weight_kg: 75.6, body_fat_pct: 19.3, muscle_pct: 41.4 },
      ];
      expect(progressCard({ items })).toEqual({ value: '74.5 kg', sub: '18.2 % grasa · 42.1 % músculo' });
    });
    it('sin registros', () => {
      expect(progressCard({ items: [] })).toEqual({ value: 'Sin registros', sub: 'Registra tu primer progreso' });
    });
  });

  describe('attendanceCard', () => {
    const rec = (timestamp: string): AttendanceRecord => ({ id: 1, email: 'a@b.c', role: 'CUSTOMER', timestamp });
    it('último ingreso de hoy y de otro día', () => {
      expect(attendanceCard([rec('2026-09-12T17:40:00'), rec('2026-09-19T06:45:00')], sat).value).toBe('Hoy · 06:45');
      expect(attendanceCard([rec('2026-09-12T17:40:00')], sat).value).toBe('12 sep · 17:40');
    });
    it('sin ingresos', () => {
      expect(attendanceCard([], sat)).toEqual({ value: 'Sin ingresos', sub: 'Marca tu asistencia al llegar' });
    });
  });
});
