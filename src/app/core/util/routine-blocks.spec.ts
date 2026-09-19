import {
  REST_LABEL,
  WEEKDAYS,
  blockLabel,
  hasRoutineFor,
  todayKey,
  weekdayInfo,
  weekdayKeyFromDate,
} from './routine-blocks';

describe('routine-blocks', () => {
  it('traduce los 6 bloques del backend', () => {
    expect(['Legs', 'Chest', 'Back', 'Shoulders', 'Arms', 'Cardio'].map(blockLabel)).toEqual([
      'Piernas',
      'Pecho',
      'Espalda',
      'Hombros',
      'Brazos',
      'Cardio',
    ]);
  });

  it('sin bloque (domingo) es Descanso', () => {
    expect(blockLabel(undefined)).toBe(REST_LABEL);
    expect(blockLabel(null)).toBe('Descanso');
    expect(blockLabel('')).toBe('Descanso');
  });

  it('un bloque desconocido se devuelve tal cual', () => {
    expect(blockLabel('Yoga')).toBe('Yoga');
  });

  it('la semana empieza en lunes y tiene 7 días con etiquetas en español', () => {
    expect(WEEKDAYS).toHaveLength(7);
    expect(WEEKDAYS[0]).toEqual({ key: 'monday', short: 'Lun', long: 'Lunes' });
    expect(WEEKDAYS[6]).toEqual({ key: 'sunday', short: 'Dom', long: 'Domingo' });
    expect(weekdayInfo('wednesday').short).toBe('Mié');
  });

  it('todayKey / weekdayKeyFromDate mapean cada día de la semana', () => {
    // 2026-09-14 es lunes
    const expected = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
    expected.forEach((key, i) => {
      expect(weekdayKeyFromDate(new Date(2026, 8, 14 + i))).toBe(key);
    });
    expect(todayKey(new Date(2026, 8, 19))).toBe('saturday');
    expect(todayKey(new Date(2026, 8, 20))).toBe('sunday');
  });

  it('solo el domingo no tiene rutina', () => {
    expect(hasRoutineFor('sunday')).toBe(false);
    expect(WEEKDAYS.filter((d) => hasRoutineFor(d.key))).toHaveLength(6);
  });
});
