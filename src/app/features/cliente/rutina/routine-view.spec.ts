import { RoutineHistoryItem } from '../../../core/models';
import { activePlan, historyEntries, planSummary } from './routine-view';

const week = {
  monday: 'Legs',
  tuesday: 'Chest',
  wednesday: 'Back',
  thursday: 'Shoulders',
  friday: 'Arms',
  saturday: 'Cardio',
};
const older: RoutineHistoryItem = {
  created_at: '2026-07-14T10:00:00',
  plan: { ...week, monday: 'Cardio', saturday: 'Legs' },
};
const latest: RoutineHistoryItem = { created_at: '2026-09-08T09:15:00', plan: week };

describe('routine-view', () => {
  it('sin historial no hay rutina activa', () => {
    expect(activePlan([])).toBeNull();
  });

  it('la activa es la última del historial', () => {
    expect(activePlan([older, latest])).toEqual(week);
  });

  it('el resumen traduce los bloques en orden lunes a sábado', () => {
    expect(planSummary(week)).toBe('Piernas · Pecho · Espalda · Hombros · Brazos · Cardio');
  });

  it('el resumen omite los días sin bloque (y el domingo)', () => {
    expect(planSummary({ monday: 'Legs', sunday: 'Chest' })).toBe('Piernas');
    expect(planSummary({})).toBe('');
  });

  it('el historial va de más reciente a más antiguo y marca solo la última como activa', () => {
    const entries = historyEntries([older, latest]);
    expect(entries.map((e) => e.createdAt)).toEqual([latest.created_at, older.created_at]);
    expect(entries.map((e) => e.active)).toEqual([true, false]);
    expect(entries[1].summary).toBe('Cardio · Pecho · Espalda · Hombros · Brazos · Piernas');
  });

  it('un solo elemento es la activa', () => {
    expect(historyEntries([latest]).map((e) => e.active)).toEqual([true]);
  });

  it('un bloque desconocido se muestra tal cual', () => {
    expect(planSummary({ monday: 'Yoga' })).toBe('Yoga');
  });
});
