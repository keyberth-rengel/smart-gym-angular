import { dayLabel, formatDate, formatDateTime, formatTime, isToday, toIsoDate } from './dates';

describe('dates', () => {
  const now = new Date(2026, 8, 19, 14, 20);

  it('formatDate: "15 sep 2026" sin desfase de zona horaria', () => {
    expect(formatDate('2026-09-15')).toBe('15 sep 2026');
    expect(formatDate('2026-01-01')).toBe('01 ene 2026');
    expect(formatDate('2026-12-31')).toBe('31 dic 2026');
    expect(formatDate(new Date(2026, 4, 5))).toBe('05 may 2026');
  });

  it('formatTime acepta ISO local, Date y HH:mm[:ss]', () => {
    expect(formatTime('2026-09-19T06:45:12.5')).toBe('06:45');
    expect(formatTime('16:30')).toBe('16:30');
    expect(formatTime('16:30:00')).toBe('16:30');
    expect(formatTime(new Date(2026, 8, 19, 9, 5))).toBe('09:05');
  });

  it('formatDateTime combina fecha y hora', () => {
    expect(formatDateTime('2026-09-19T06:45:00')).toBe('19 sep 2026 · 06:45');
  });

  it('toIsoDate usa la fecha local', () => {
    expect(toIsoDate(new Date(2026, 8, 5, 23, 59))).toBe('2026-09-05');
    expect(toIsoDate(now)).toBe('2026-09-19');
  });

  it('isToday y dayLabel', () => {
    expect(isToday('2026-09-19', now)).toBe(true);
    expect(isToday('2026-09-18', now)).toBe(false);
    expect(dayLabel('2026-09-19', now)).toBe('Hoy');
    expect(dayLabel('2026-09-12', now)).toBe('12 sep 2026');
  });
});
