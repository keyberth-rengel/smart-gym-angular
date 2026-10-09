import { serverTimestamp } from '../../testing/server-timestamp';
import {
  dayLabel,
  formatDate,
  formatDateTime,
  formatTime,
  isToday,
  relativeDay,
  toIsoDate,
  toTimestamp,
} from './dates';

describe('dates', () => {
  const now = new Date(2026, 8, 19, 14, 20);

  it('formatDate: "15 sep 2026" sin desfase de zona horaria', () => {
    expect(formatDate('2026-09-15')).toBe('15 sep 2026');
    expect(formatDate('2026-01-01')).toBe('01 ene 2026');
    expect(formatDate('2026-12-31')).toBe('31 dic 2026');
    expect(formatDate(new Date(2026, 4, 5))).toBe('05 may 2026');
  });

  it('formatTime acepta ISO local, Date y HH:mm[:ss]', () => {
    expect(formatTime(serverTimestamp('2026-09-19T06:45:12'))).toBe('06:45');
    expect(formatTime('16:30')).toBe('16:30');
    expect(formatTime('16:30:00')).toBe('16:30');
    expect(formatTime(new Date(2026, 8, 19, 9, 5))).toBe('09:05');
  });

  it('formatDateTime combina fecha y hora', () => {
    expect(formatDateTime(serverTimestamp('2026-09-19T06:45:00'))).toBe('19 sep 2026 · 06:45');
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

describe('formatDayMonth / formatYear', () => {
  it('separa día y mes del año', async () => {
    const { formatDayMonth, formatYear } = await import('./dates');
    expect(formatDayMonth('2026-09-15')).toBe('15 sep');
    expect(formatYear('2026-09-15')).toBe('2026');
    expect(formatDayMonth('2026-01-05T08:30:00')).toBe('05 ene');
  });
});

describe('marcas de tiempo del backend (UTC sin zona)', () => {
  // 2026-10-09T03:49:12 UTC; sus getters locales dependen de la zona de la máquina.
  const naive = '2026-10-09T03:49:12.123';
  const instant = new Date('2026-10-09T03:49:12.123Z');
  const pad = (n: number) => String(n).padStart(2, '0');

  it('se interpreta como UTC y se muestra en la zona del navegador', () => {
    expect(formatTime(naive)).toBe(`${pad(instant.getHours())}:${pad(instant.getMinutes())}`);
    expect(formatDate(naive)).toBe(formatDate(instant));
    expect(toTimestamp(naive)).toBe(instant.getTime());
  });

  it('acepta separador con espacio y sin fracción de segundo', () => {
    expect(toTimestamp('2026-10-09 03:49:12')).toBe(Date.UTC(2026, 9, 9, 3, 49, 12));
    expect(toTimestamp('2026-10-09T03:49')).toBe(Date.UTC(2026, 9, 9, 3, 49));
  });

  it('con zona explícita no se modifica', () => {
    expect(toTimestamp('2026-10-09T03:49:12Z')).toBe(Date.UTC(2026, 9, 9, 3, 49, 12));
    expect(toTimestamp('2026-10-09T03:49:12-05:00')).toBe(Date.UTC(2026, 9, 9, 8, 49, 12));
    expect(toTimestamp('2026-10-09T03:49:12+02:00')).toBe(Date.UTC(2026, 9, 9, 1, 49, 12));
  });

  it('yyyy-MM-dd sigue siendo medianoche local', () => {
    expect(toTimestamp('2026-10-09')).toBe(new Date(2026, 9, 9).getTime());
  });

  it('isToday, dayLabel y relativeDay usan el día local del instante', () => {
    const now = new Date(instant.getTime() + 60_000); // un minuto después, mismo día local o el siguiente
    expect(isToday(naive, instant)).toBe(true);
    expect(dayLabel(naive, now)).toBe(isToday(naive, now) ? 'Hoy' : formatDate(instant));
    expect(relativeDay(naive, instant)).toBe('Hoy');
  });

  it('un ingreso a las 03:49 UTC cae en el día local anterior si la zona está detrás de UTC', () => {
    const local = new Date(2026, 9, 8, 22, 49); // 22:49 locales
    const sent = serverTimestamp('2026-10-08T22:49:00'); // lo que enviaría el servidor
    expect(formatTime(sent)).toBe('22:49');
    expect(isToday(sent, local)).toBe(true);
    expect(formatDate(sent)).toBe('08 oct 2026');
  });
});
